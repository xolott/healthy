import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import 'pantry_catalog_helpers.dart';
import 'pantry_catalog_item.dart';
import 'pantry_food_catalog_list_tile.dart';
import 'pantry_http.dart';

typedef PantryItemTap =
    void Function(BuildContext context, PantryCatalogItem item);
typedef PantryItemSuffix = String? Function(PantryCatalogItem item);

class PantryInfiniteCatalogList extends StatefulWidget {
  const PantryInfiniteCatalogList({
    super.key,
    required this.itemType,
    required this.searchHint,
    required this.emptyMessage,
    required this.noMatchesMessage,
    required this.searchFieldKey,
    required this.onTapItem,
    required this.suffixForItem,
    this.reloadSignal,
    this.onFoodTrailingAdd,
  });

  final PantryCatalogItemType itemType;
  final String searchHint;
  final String emptyMessage;
  final String noMatchesMessage;
  final Key searchFieldKey;
  final PantryItemTap onTapItem;
  final PantryItemSuffix suffixForItem;

  /// When incremented (e.g. after creating an item), this tab reloads from the server.
  final ValueNotifier<int>? reloadSignal;

  /// Optional trailing add on Food rows; omitted in catalog until logging exists.
  final void Function(PantryCatalogItem item)? onFoodTrailingAdd;

  @override
  State<PantryInfiniteCatalogList> createState() =>
      _PantryInfiniteCatalogListState();
}

class _PantryInfiniteCatalogListState extends State<PantryInfiniteCatalogList> {
  static const int _pageSize = 20;

  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  bool _initialLoading = true;
  bool _isLoadingMore = false;
  String? _error;
  List<PantryCatalogItem> _items = [];
  int _visibleCount = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    widget.reloadSignal?.addListener(_onReloadSignal);
    _loadInitial();
  }

  @override
  void didUpdateWidget(PantryInfiniteCatalogList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reloadSignal != widget.reloadSignal) {
      oldWidget.reloadSignal?.removeListener(_onReloadSignal);
      widget.reloadSignal?.addListener(_onReloadSignal);
    }
  }

  void _onReloadSignal() {
    _reloadCatalog();
  }

  @override
  void dispose() {
    widget.reloadSignal?.removeListener(_onReloadSignal);
    _searchController.dispose();
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  Future<String> _resolveBaseUrl() async {
    final base = await ApiBaseUrlStore.read();
    return base?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  Future<List<PantryCatalogItem>> _fetchParsedItems() async {
    final base = await _resolveBaseUrl();
    if (base.isEmpty) {
      throw const _CatalogLoadException('Server URL is not configured.');
    }
    final token = await readSessionToken();
    if (token == null || token.isEmpty) {
      throw const _CatalogLoadException('Not signed in.');
    }

    final uri = Uri.parse(
      '$base/pantry/items?itemType=${widget.itemType.wireValue}',
    );
    final response = await PantryHttp.get(
      uri,
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    if (response.statusCode != 200) {
      throw const _CatalogLoadException('Unable to load your Pantry.');
    }
    final body = jsonDecode(response.body);
    if (body is! Map<String, dynamic>) {
      throw const _CatalogLoadException('Unable to load your Pantry.');
    }
    final rawItems = body['items'];
    if (rawItems is! List<dynamic>) {
      throw const _CatalogLoadException('Unable to load your Pantry.');
    }
    return rawItems
        .map(parsePantryCatalogItem)
        .whereType<PantryCatalogItem>()
        .where((item) => item.itemType == widget.itemType)
        .toList();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _initialLoading = true;
      _error = null;
      _items = [];
      _visibleCount = 0;
    });

    try {
      final parsed = await _fetchParsedItems();
      if (!mounted) {
        return;
      }
      setState(() {
        _items = parsed;
        _error = null;
        _visibleCount = _initialVisibleCount(_filteredItems().length);
      });
    } on _CatalogLoadException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = 'Unable to load your Pantry.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _initialLoading = false;
          _isLoadingMore = false;
        });
      }
    }
  }

  Future<void> _reloadCatalog() async {
    if (_initialLoading) {
      return;
    }
    try {
      final parsed = await _fetchParsedItems();
      if (!mounted) {
        return;
      }
      setState(() {
        _items = parsed;
        _error = null;
        final filteredLen = _filteredItems().length;
        _visibleCount = _initialVisibleCount(filteredLen);
        _isLoadingMore = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      if (_items.isNotEmpty) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          const SnackBar(content: Text('Could not refresh Pantry.')),
        );
      } else {
        setState(() {
          _error = 'Unable to load your Pantry.';
        });
      }
    }
  }

  int _initialVisibleCount(int total) => total < _pageSize ? total : _pageSize;

  List<PantryCatalogItem> _filteredItems() {
    final query = _searchController.text;
    return _items
        .where(
          (item) => pantrySearchMatches(
            query,
            name: item.name,
            brand: widget.itemType == PantryCatalogItemType.food
                ? item.brand
                : null,
          ),
        )
        .toList();
  }

  bool _canLoadMore(List<PantryCatalogItem> filtered) =>
      _visibleCount < filtered.length;

  void _onScroll() {
    if (!_scrollController.hasClients) {
      return;
    }
    final threshold = _scrollController.position.maxScrollExtent - 240;
    if (_scrollController.position.pixels >= threshold) {
      _loadMore();
    }
  }

  void _loadMore() {
    if (_isLoadingMore) {
      return;
    }
    final filtered = _filteredItems();
    if (!_canLoadMore(filtered)) {
      return;
    }
    setState(() {
      _isLoadingMore = true;
    });
    Future<void>.delayed(const Duration(milliseconds: 120), () {
      if (!mounted) {
        return;
      }
      final latestFiltered = _filteredItems();
      setState(() {
        _visibleCount = (_visibleCount + _pageSize).clamp(
          0,
          latestFiltered.length,
        );
        _isLoadingMore = false;
      });
    });
  }

  void _onSearchChanged(String _) {
    final total = _filteredItems().length;
    setState(() {
      _visibleCount = _initialVisibleCount(total);
    });
  }

  Widget _searchSliver() {
    final hasQuery = _searchController.text.isNotEmpty;
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: SearchBar(
          key: widget.searchFieldKey,
          controller: _searchController,
          hintText: widget.searchHint,
          onChanged: _onSearchChanged,
          leading: const Icon(Icons.search),
          trailing: <Widget>[
            if (hasQuery)
              IconButton(
                icon: const Icon(Icons.clear),
                tooltip: 'Clear',
                onPressed: () {
                  _searchController.clear();
                  _onSearchChanged('');
                },
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _contentSliversAfterSearch() {
    if (_error != null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text(
              _error!,
              key: Key('pantry-${widget.itemType.wireValue}-items-error'),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ];
    }

    final filtered = _filteredItems();
    final shown = filtered.take(_visibleCount).toList();

    if (_items.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text(
              widget.emptyMessage,
              key: Key('pantry-${widget.itemType.wireValue}-empty'),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ];
    }

    if (filtered.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text(
              widget.noMatchesMessage,
              key: Key('pantry-${widget.itemType.wireValue}-search-no-matches'),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ];
    }

    final extra = _canLoadMore(filtered) ? 1 : 0;
    return [
      SliverList(
        delegate: SliverChildBuilderDelegate((context, index) {
          if (index >= shown.length) {
            if (!_isLoadingMore) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                _loadMore();
              });
            }
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final item = shown[index];
          if (widget.itemType == PantryCatalogItemType.food) {
            return PantryFoodCatalogListTile(
              item: item,
              onTap: () => widget.onTapItem(context, item),
              onTrailingAddPressed: widget.onFoodTrailingAdd != null
                  ? () => widget.onFoodTrailingAdd!(item)
                  : null,
            );
          }
          final parts = <String>[item.iconKey];
          final suffix = widget.suffixForItem(item);
          if (suffix != null && suffix.isNotEmpty) {
            parts.add(suffix);
          }
          return ListTile(
            dense: true,
            title: Text(item.name),
            subtitle: Text(
              parts.join(' · '),
              style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
            ),
            onTap: () => widget.onTapItem(context, item),
          );
        }, childCount: shown.length + extra),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (_initialLoading) {
      return Material(
        color: Colors.transparent,
        child: RefreshIndicator(
          onRefresh: _loadInitial,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              _searchSliver(),
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              ),
            ],
          ),
        ),
      );
    }

    return Material(
      color: Colors.transparent,
      child: RefreshIndicator(
        onRefresh: _reloadCatalog,
        child: CustomScrollView(
          key: Key('pantry-${widget.itemType.wireValue}-tab-scroll'),
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [_searchSliver(), ..._contentSliversAfterSearch()],
        ),
      ),
    );
  }
}

class _CatalogLoadException implements Exception {
  const _CatalogLoadException(this.message);

  final String message;
}
