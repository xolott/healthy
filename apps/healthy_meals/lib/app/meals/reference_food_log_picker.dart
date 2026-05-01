import 'dart:async';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import 'reference_food_log_wire.dart';

/// Reference catalog search + detail before returning a row for the Food Log composer.
class ReferenceFoodLogCatalogPane extends StatefulWidget {
  const ReferenceFoodLogCatalogPane({super.key});

  @override
  State<ReferenceFoodLogCatalogPane> createState() =>
      _ReferenceFoodLogCatalogPaneState();
}

class _ReferenceFoodLogCatalogPaneState
    extends State<ReferenceFoodLogCatalogPane> {
  final TextEditingController _queryController = TextEditingController();
  Timer? _debounce;
  List<ReferenceFoodSearchCard> _results = const [];
  bool _loading = false;
  bool _searchUnavailable = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _runSearch(String raw) async {
    final q = raw.trim();
    if (q.isEmpty) {
      setState(() {
        _results = const [];
        _loading = false;
        _searchUnavailable = false;
        _error = null;
      });
      return;
    }
    final base = await referenceFoodLogResolveBaseUrl();
    final token = await readSessionToken();
    if (!mounted) {
      return;
    }
    if (base.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Server URL is not configured.';
        _results = const [];
      });
      return;
    }
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Not signed in.';
        _results = const [];
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _searchUnavailable = false;
    });
    final items = await fetchReferenceFoodSearch(
      baseUrl: base,
      token: token,
      query: q,
    );
    if (!mounted) {
      return;
    }
    if (items == null) {
      setState(() {
        _loading = false;
        _searchUnavailable = true;
        _results = const [];
      });
      return;
    }
    setState(() {
      _loading = false;
      _results = items;
    });
  }

  void _onQueryChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 320), () => _runSearch(v));
  }

  Future<void> _openDetail(ReferenceFoodSearchCard card) async {
    final detail = await Navigator.of(context).push<ReferenceFoodDetailForLog>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) =>
            ReferenceFoodLogDetailScreen(referenceFoodId: card.id),
      ),
    );
    if (detail != null && mounted) {
      Navigator.of(context).pop(detail);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              key: const Key('food-log-reference-search'),
              controller: _queryController,
              decoration: const InputDecoration(
                hintText: 'Search catalog by name or brand…',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: _onQueryChanged,
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(_error!, style: TextStyle(color: scheme.error)),
            ),
          if (_searchUnavailable)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                'Catalog search is unavailable. Try again later or log from '
                'your Pantry.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _results.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _queryController.text.trim().isEmpty
                            ? 'Search the reference catalog. Items are not '
                                  'added to your Pantry.'
                            : 'No catalog foods match your search.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final card = _results[index];
                      final brandLine =
                          card.brand != null && card.brand!.isNotEmpty
                          ? '${card.displayName} · ${card.brand}'
                          : card.displayName;
                      final previewBits = <String>[];
                      if (card.foodClass != null &&
                          card.foodClass!.trim().isNotEmpty) {
                        previewBits.add(card.foodClass!.trim());
                      }
                      previewBits.add(card.source);
                      if (card.servingPreviewLabel != null) {
                        final g = card.servingPreviewGrams;
                        final gStr = g == null
                            ? ''
                            : (g == g.roundToDouble()
                                  ? '${g.toInt()} g'
                                  : '${g.toStringAsFixed(1)} g');
                        previewBits.add(
                          gStr.isEmpty
                              ? card.servingPreviewLabel!
                              : '${card.servingPreviewLabel!} ($gStr)',
                        );
                      }
                      final baseG = card.macrosBaseAmountGrams;
                      final baseStr = baseG == baseG.roundToDouble()
                          ? '${baseG.toInt()}'
                          : baseG.toStringAsFixed(1);
                      final cal = card.macrosCalories;
                      final calStr = cal == cal.roundToDouble()
                          ? '${cal.toInt()}'
                          : cal.toStringAsFixed(0);
                      previewBits.add('$calStr kcal / $baseStr g');
                      final sub = previewBits.join(' · ');
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          key: Key('food-log-reference-card-${card.id}'),
                          title: Text(brandLine),
                          subtitle: Text(sub),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => _openDetail(card),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class ReferenceFoodLogDetailScreen extends StatefulWidget {
  const ReferenceFoodLogDetailScreen({
    super.key,
    required this.referenceFoodId,
  });

  final String referenceFoodId;

  @override
  State<ReferenceFoodLogDetailScreen> createState() =>
      _ReferenceFoodLogDetailScreenState();
}

class _ReferenceFoodLogDetailScreenState
    extends State<ReferenceFoodLogDetailScreen> {
  ReferenceFoodDetailForLog? _detail;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final base = await referenceFoodLogResolveBaseUrl();
    final token = await readSessionToken();
    if (!mounted) {
      return;
    }
    if (base.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Server URL is not configured.';
      });
      return;
    }
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Not signed in.';
      });
      return;
    }
    final detail = await fetchReferenceFoodDetail(
      baseUrl: base,
      token: token,
      referenceFoodId: widget.referenceFoodId,
    );
    if (!mounted) {
      return;
    }
    if (detail == null) {
      setState(() {
        _loading = false;
        _error = 'Unable to load this catalog item.';
      });
      return;
    }
    setState(() {
      _loading = false;
      _detail = detail;
      _error = null;
    });
  }

  static String _fmtGram(double g) {
    if (g == g.roundToDouble()) {
      return '${g.toInt()}';
    }
    return g.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Catalog item'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : detail == null
          ? const SizedBox.shrink()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  detail.brand != null && detail.brand!.isNotEmpty
                      ? '${detail.displayName} · ${detail.brand}'
                      : detail.displayName,
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  [
                    detail.source,
                    if (detail.foodClass != null &&
                        detail.foodClass!.trim().isNotEmpty)
                      detail.foodClass!.trim(),
                  ].join(' · '),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Per ${_fmtGram(detail.baseAmountGrams)} g: '
                  '${_fmtGram(detail.calories)} kcal · '
                  'P ${_fmtGram(detail.proteinGrams)} g · '
                  'C ${_fmtGram(detail.carbohydratesGrams)} g · '
                  'F ${_fmtGram(detail.fatGrams)} g',
                  style: theme.textTheme.bodyMedium,
                ),
                if (detail.servings.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('Servings', style: theme.textTheme.titleSmall),
                  const SizedBox(height: 8),
                  for (final s in detail.servings)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        s.gramWeight != null
                            ? '${s.label}: ${_fmtGram(s.gramWeight!)} g'
                            : '${s.label}: —',
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  key: const Key('food-log-reference-detail-use'),
                  onPressed: () => Navigator.of(context).pop(detail),
                  child: const Text('Choose servings on next screen'),
                ),
              ],
            ),
    );
  }
}
