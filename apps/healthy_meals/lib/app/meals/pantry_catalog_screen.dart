import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../../shared/widgets/shell_scaffold.dart';
import 'pantry_catalog_helpers.dart';
import 'pantry_http.dart';

enum _PantryTab { food, recipe }

/// Server-backed Pantry catalog (Food / Recipe tabs); empty state when the user has no saved items.
class MealsPantryCatalogScreen extends StatefulWidget {
  const MealsPantryCatalogScreen({super.key});

  @override
  State<MealsPantryCatalogScreen> createState() =>
      _MealsPantryCatalogScreenState();
}

class _MealsPantryCatalogScreenState extends State<MealsPantryCatalogScreen> {
  _PantryTab _tab = _PantryTab.food;
  bool _initialLoading = true;
  bool _itemsRefreshing = false;
  String? _referenceError;
  String? _itemsError;
  int? _nutrientsCount;
  int? _iconKeysCount;
  List<_PantryItemWire> _items = [];
  late final TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _hydrate();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<String> _resolveBaseUrl() async {
    final u = await ApiBaseUrlStore.read();
    return u?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  Future<void> _hydrate() async {
    setState(() {
      _initialLoading = true;
      _referenceError = null;
      _itemsError = null;
    });

    final base = await _resolveBaseUrl();
    if (base.isEmpty) {
      setState(() {
        _initialLoading = false;
        _referenceError = 'Server URL is not configured.';
      });
      return;
    }

    final token = await readSessionToken();
    if (token == null || token.isEmpty) {
      setState(() {
        _initialLoading = false;
        _referenceError = 'Not signed in.';
      });
      return;
    }

    try {
      final refUri = Uri.parse('$base/pantry/reference');
      final refRes = await PantryHttp.get(
        refUri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      if (refRes.statusCode != 200) {
        setState(() {
          _initialLoading = false;
          _referenceError = 'Unable to load nutrient catalog.';
        });
        return;
      }
      final refBody = jsonDecode(refRes.body);
      if (refBody is! Map<String, dynamic>) {
        throw const FormatException('reference');
      }
      final nutrients = refBody['nutrients'];
      final iconKeys = refBody['iconKeys'];
      if (nutrients is! List<dynamic> || iconKeys is! List<dynamic>) {
        throw const FormatException('reference shape');
      }

      final itemsUri = Uri.parse(
        '$base/pantry/items?itemType=${_tab == _PantryTab.food ? 'food' : 'recipe'}',
      );
      final itemsRes = await PantryHttp.get(
        itemsUri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      if (itemsRes.statusCode != 200) {
        setState(() {
          _nutrientsCount = nutrients.length;
          _iconKeysCount = iconKeys.length;
          _initialLoading = false;
          _itemsError = 'Unable to load your Pantry.';
          _items = [];
        });
        return;
      }
      final itemsBody = jsonDecode(itemsRes.body);
      if (itemsBody is! Map<String, dynamic>) {
        throw const FormatException('items');
      }
      final rawItems = itemsBody['items'];
      if (rawItems is! List<dynamic>) {
        throw const FormatException('items list');
      }
      final parsed = rawItems
          .map(_parsePantryListItem)
          .whereType<_PantryItemWire>()
          .toList();

      setState(() {
        _nutrientsCount = nutrients.length;
        _iconKeysCount = iconKeys.length;
        _items = parsed;
        _initialLoading = false;
      });
    } catch (_) {
      setState(() {
        _initialLoading = false;
        _referenceError = 'Unable to load Pantry.';
      });
    }
  }

  Future<void> _reloadItemsOnly() async {
    final base = await _resolveBaseUrl();
    if (base.isEmpty) {
      return;
    }
    final token = await readSessionToken();
    if (token == null || token.isEmpty) {
      return;
    }

    setState(() {
      _itemsRefreshing = true;
      _itemsError = null;
    });

    try {
      final itemsUri = Uri.parse(
        '$base/pantry/items?itemType=${_tab == _PantryTab.food ? 'food' : 'recipe'}',
      );
      final itemsRes = await PantryHttp.get(
        itemsUri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      if (itemsRes.statusCode != 200) {
        setState(() {
          _itemsError = 'Unable to load your Pantry.';
          _items = [];
        });
        return;
      }
      final itemsBody = jsonDecode(itemsRes.body);
      if (itemsBody is! Map<String, dynamic>) {
        throw const FormatException('items');
      }
      final rawItems = itemsBody['items'];
      if (rawItems is! List<dynamic>) {
        throw const FormatException('items list');
      }
      final parsed = rawItems
          .map(_parsePantryListItem)
          .whereType<_PantryItemWire>()
          .toList();

      setState(() {
        _items = parsed;
      });
    } catch (_) {
      setState(() {
        _itemsError = 'Unable to load your Pantry.';
        _items = [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _itemsRefreshing = false;
        });
      }
    }
  }

  void _setTab(_PantryTab t) {
    if (_tab == t) {
      return;
    }
    setState(() {
      _tab = t;
      _searchController.clear();
    });
    _reloadItemsOnly();
  }

  List<_PantryItemWire> _visibleItems() {
    return _items
        .where(
          (it) => pantrySearchMatches(
            _searchController.text,
            name: it.name,
            brand: _tab == _PantryTab.food ? it.brand : null,
          ),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final visibleItems = _visibleItems();
    return ShellScaffold(
      title: 'Pantry',
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Browse foods and recipes you save for logging. Tabs load from your server catalog.',
              style: TextStyle(fontSize: 14, color: Colors.black54),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                TextButton(
                  key: const Key('pantry-tab-food'),
                  onPressed: () => _setTab(_PantryTab.food),
                  child: const Text('Foods'),
                ),
                TextButton(
                  key: const Key('pantry-tab-recipes'),
                  onPressed: () => _setTab(_PantryTab.recipe),
                  child: const Text('Recipes'),
                ),
                if (_tab == _PantryTab.food)
                  TextButton(
                    key: const Key('pantry-add-food'),
                    onPressed: () async {
                      final created = await context.push<bool>(
                        '/pantry/create-food',
                      );
                      if (created == true && mounted) {
                        await _reloadItemsOnly();
                      }
                    },
                    child: const Text('Add food'),
                  ),
                if (_tab == _PantryTab.recipe)
                  TextButton(
                    key: const Key('pantry-add-recipe'),
                    onPressed: () async {
                      final created = await context.push<bool>(
                        '/pantry/create-recipe',
                      );
                      if (created == true && mounted) {
                        await _reloadItemsOnly();
                      }
                    },
                    child: const Text('Add recipe'),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (_referenceError != null)
              Text(_referenceError!, key: const Key('pantry-reference-error'))
            else if (!_initialLoading && _nutrientsCount != null)
              Text(
                'Nutrients in catalog: $_nutrientsCount · Icon keys: $_iconKeysCount',
                key: const Key('pantry-catalog-health'),
                style: const TextStyle(fontSize: 12, color: Colors.black45),
              ),
            if (!_initialLoading &&
                !_itemsRefreshing &&
                _itemsError == null &&
                _referenceError == null) ...[
              const SizedBox(height: 8),
              TextField(
                key: const Key('pantry-items-search'),
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: _tab == _PantryTab.food
                      ? 'Search foods by name or brand…'
                      : 'Search recipes by name…',
                  isDense: true,
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (_initialLoading || _itemsRefreshing)
              const Text('Loading…')
            else if (_itemsError != null)
              Text(_itemsError!, key: const Key('pantry-items-error'))
            else if (_items.isEmpty)
              Text(
                _tab == _PantryTab.food
                    ? 'No foods yet. Saved items appear here once you add them.'
                    : 'No recipes yet. Saved items appear here once you add them.',
                key: const Key('pantry-empty'),
              )
            else if (visibleItems.isEmpty)
              Text(
                _tab == _PantryTab.food
                    ? 'No foods match your search.'
                    : 'No recipes match your search.',
                key: const Key('pantry-search-no-matches'),
              )
            else
              Expanded(
                child: ListView.builder(
                  itemCount: visibleItems.length,
                  itemBuilder: (context, i) {
                    final it = visibleItems[i];
                    final subParts = <String>[it.iconKey];
                    if (_tab == _PantryTab.food && it.caloriesPerBase != null) {
                      subParts.add(
                        '${it.caloriesPerBase!.toStringAsFixed(0)} kcal',
                      );
                    }
                    if (_tab == _PantryTab.recipe && it.caloriesPerBase != null) {
                      subParts.add(
                        '${it.caloriesPerBase!.toStringAsFixed(0)} kcal/serving',
                      );
                    }
                    return ListTile(
                      dense: true,
                      title: Text(it.name),
                      subtitle: Text(
                        subParts.join(' · '),
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11,
                        ),
                      ),
                      onTap: it.itemType == 'food' && _tab == _PantryTab.food
                          ? () {
                              context.push('/pantry/food/${it.id}');
                            }
                          : it.itemType == 'recipe' && _tab == _PantryTab.recipe
                              ? () {
                                  context.push('/pantry/recipe/${it.id}');
                                }
                              : null,
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

_PantryItemWire? _parsePantryListItem(dynamic e) {
  if (e is! Map<String, dynamic>) {
    return null;
  }
  final id = e['id'];
  final name = e['name'];
  final iconKey = e['iconKey'];
  final itemType = e['itemType'];
  final rawMeta = e['metadata'];
  Map<String, dynamic>? metaMap;
  if (rawMeta is Map<String, dynamic>) {
    metaMap = rawMeta;
  } else if (rawMeta is Map) {
    metaMap = Map<String, dynamic>.from(rawMeta);
  }
  if (id is! String ||
      name is! String ||
      iconKey is! String ||
      itemType is! String) {
    return null;
  }
  double? cal;
  if (itemType == 'food') {
    cal = foodListCaloriesFromMetadata(metaMap);
  } else if (itemType == 'recipe') {
    cal = recipeListCaloriesPerServingFromMetadata(metaMap);
  }
  return _PantryItemWire(
    id: id,
    name: name,
    iconKey: iconKey,
    itemType: itemType,
    brand: pantryBrandFromMetadata(metaMap),
    caloriesPerBase: cal,
  );
}

class _PantryItemWire {
  const _PantryItemWire({
    required this.id,
    required this.name,
    required this.iconKey,
    required this.itemType,
    this.brand,
    this.caloriesPerBase,
  });

  final String id;
  final String name;
  final String iconKey;
  final String itemType;
  final String? brand;
  final double? caloriesPerBase;
}
