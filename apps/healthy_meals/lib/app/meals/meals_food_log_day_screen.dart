import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:intl/intl.dart';

import '../../core/navigation/meals_destinations.dart';
import 'meals_food_log_shell_sync.dart';
import 'pantry_http.dart';

/// One Food Log Entry row as returned by GET `/food-log/entries`.
@immutable
class FoodLogEntryListItem {
  const FoodLogEntryListItem({
    required this.id,
    required this.displayName,
    required this.calories,
    required this.proteinGrams,
    required this.fatGrams,
    required this.carbohydratesGrams,
    required this.consumedDate,
    required this.quantity,
    required this.servingKind,
    this.servingUnit,
    this.servingCustomLabel,
  });

  final String id;
  final String displayName;
  final double calories;
  final double proteinGrams;
  final double fatGrams;
  final double carbohydratesGrams;
  final String consumedDate;
  final double quantity;
  final String servingKind;
  final String? servingUnit;
  final String? servingCustomLabel;

  /// Line such as `2 × slice` describing how this entry was counted.
  String get consumedServingSummaryLine {
    final q = quantity;
    final qStr = q == q.roundToDouble() ? '${q.toInt()}' : q.toStringAsFixed(1);
    final servingLabel = switch (servingKind) {
      'base' => 'base serving',
      'unit' => servingUnit ?? 'unit',
      'custom' => servingCustomLabel ?? 'serving',
      final k => k,
    };
    return '$qStr × $servingLabel';
  }

  static FoodLogEntryListItem? tryParse(dynamic e) {
    if (e is! Map<String, dynamic>) {
      return null;
    }
    final id = e['id'];
    final name = e['displayName'];
    final cal = e['calories'];
    final p = e['proteinGrams'];
    final f = e['fatGrams'];
    final c = e['carbohydratesGrams'];
    final d = e['consumedDate'];
    final qty = e['quantity'];
    Map<String, dynamic>? soRaw;
    final soDyn = e['servingOption'];
    if (soDyn is Map<String, dynamic>) {
      soRaw = soDyn;
    } else if (soDyn is Map) {
      soRaw = Map<String, dynamic>.from(soDyn);
    }
    if (id is! String ||
        name is! String ||
        cal is! num ||
        p is! num ||
        f is! num ||
        c is! num ||
        d is! String ||
        qty is! num ||
        soRaw == null) {
      return null;
    }
    final kind = soRaw['kind'];
    if (kind is! String || kind.trim().isEmpty) {
      return null;
    }
    final k = kind.trim();
    final unitRaw = soRaw['unit'];
    final lblRaw = soRaw['label'];
    String? servingUnitParsed;
    String? servingCustomParsed;
    if (k == 'unit') {
      if (unitRaw is! String || unitRaw.trim().isEmpty) {
        return null;
      }
      servingUnitParsed = unitRaw.trim();
    } else if (k == 'custom') {
      if (lblRaw is! String || lblRaw.trim().isEmpty) {
        return null;
      }
      servingCustomParsed = lblRaw.trim();
    } else if (k != 'base') {
      return null;
    }
    return FoodLogEntryListItem(
      id: id,
      displayName: name,
      calories: cal.toDouble(),
      proteinGrams: p.toDouble(),
      fatGrams: f.toDouble(),
      carbohydratesGrams: c.toDouble(),
      consumedDate: d,
      quantity: qty.toDouble(),
      servingKind: k,
      servingUnit: servingUnitParsed,
      servingCustomLabel: servingCustomParsed,
    );
  }
}

/// Food Log tab: loads Food Log Entries for a selected local calendar day.
class MealsFoodLogDayScreen extends StatefulWidget {
  const MealsFoodLogDayScreen({super.key, this.syncFabDay = true});

  /// When true, publishes the selected day for the FAB entry composer.
  final bool syncFabDay;

  @override
  State<MealsFoodLogDayScreen> createState() => _MealsFoodLogDayScreenState();
}

class _MealsFoodLogDayScreenState extends State<MealsFoodLogDayScreen> {
  late DateTime _selectedDay;
  bool _loading = true;
  String? _error;
  List<FoodLogEntryListItem> _entries = const [];

  @override
  void initState() {
    super.initState();
    _selectedDay = _dateOnly(DateTime.now());
    mealsFoodLogDayRefreshSignal.addListener(_onRefreshSignal);
    _load();
  }

  @override
  void dispose() {
    mealsFoodLogDayRefreshSignal.removeListener(_onRefreshSignal);
    super.dispose();
  }

  void _onRefreshSignal() {
    if (mounted) {
      _load();
    }
  }

  void _publishFabDay() {
    if (!widget.syncFabDay) {
      return;
    }
    mealsFoodLogSelectedDayNotifier.value = _dateOnly(_selectedDay);
  }

  DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  String _toApiDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  String _formatHeading(DateTime d) => DateFormat.yMMMEd().format(d);

  Future<String> _resolveBaseUrl() async {
    final base = await ApiBaseUrlStore.read();
    return base?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final base = await _resolveBaseUrl();
    final token = await readSessionToken();
    if (base.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Server URL is not configured.';
        _entries = const [];
      });
      return;
    }
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Not signed in.';
        _entries = const [];
      });
      return;
    }
    final uri = Uri.parse(
      '$base/food-log/entries',
    ).replace(queryParameters: {'date': _toApiDate(_selectedDay)});
    try {
      final res = await PantryHttp.get(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      if (res.statusCode != 200) {
        setState(() {
          _loading = false;
          _error = 'Unable to load Food Log.';
          _entries = const [];
        });
        return;
      }
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) {
        setState(() {
          _loading = false;
          _error = 'Unable to load Food Log.';
          _entries = const [];
        });
        return;
      }
      final raw = body['entries'];
      final list = <FoodLogEntryListItem>[];
      if (raw is List<dynamic>) {
        for (final e in raw) {
          final row = FoodLogEntryListItem.tryParse(e);
          if (row != null) {
            list.add(row);
          }
        }
      }
      setState(() {
        _loading = false;
        _error = null;
        _entries = list;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Unable to load Food Log.';
        _entries = const [];
      });
    }
  }

  Future<void> _shiftDay(int delta) async {
    setState(() {
      _selectedDay = _dateOnly(_selectedDay.add(Duration(days: delta)));
    });
    _publishFabDay();
    await _load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _publishFabDay();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          backgroundColor: scheme.surface,
          titleSpacing: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(MealsDestinations.foodLogLabel),
              Text(
                _formatHeading(_selectedDay),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Previous day',
              icon: const Icon(Icons.chevron_left),
              onPressed: _loading ? null : () => _shiftDay(-1),
            ),
            IconButton(
              tooltip: 'Next day',
              icon: const Icon(Icons.chevron_right),
              onPressed: _loading ? null : () => _shiftDay(1),
            ),
          ],
        ),
        if (_loading)
          const SliverFillRemaining(
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_error != null)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: scheme.error,
                  ),
                ),
              ),
            ),
          )
        else if (_entries.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: _FoodLogEmptyDay(dayLabel: _formatHeading(_selectedDay)),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            sliver: SliverList.separated(
              itemCount: _entries.length,
              separatorBuilder: (context, index) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final e = _entries[i];
                return _FoodLogEntryCard(entry: e);
              },
            ),
          ),
      ],
    );
  }
}

class _FoodLogEntryCard extends StatelessWidget {
  const _FoodLogEntryCard({required this.entry});

  final FoodLogEntryListItem entry;

  static String _fmt(num v) {
    if (v == v.roundToDouble()) {
      return '${v.toInt()}';
    }
    return v.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Card(
      elevation: 0,
      color: scheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.restaurant_outlined, color: scheme.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    entry.displayName,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              entry.consumedServingSummaryLine,
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${entry.calories.round()} kcal',
              style: theme.textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Protein ${_fmt(entry.proteinGrams)} g · '
              'Carbs ${_fmt(entry.carbohydratesGrams)} g · '
              'Fat ${_fmt(entry.fatGrams)} g',
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FoodLogEmptyDay extends StatelessWidget {
  const _FoodLogEmptyDay({required this.dayLabel});

  final String dayLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Center(
      child: Padding(
        key: const Key('food-log-empty-state'),
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.restaurant_outlined, size: 56, color: scheme.primary),
            const SizedBox(height: 24),
            Text(
              'No Food Log entries',
              style: theme.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Nothing logged for $dayLabel.\n'
              'Tap + New entry when you are ready.',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
