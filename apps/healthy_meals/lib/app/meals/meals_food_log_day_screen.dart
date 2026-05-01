import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:intl/intl.dart';

import 'meals_food_log_shell_sync.dart';
import 'pantry_catalog_icon_map.dart';
import 'pantry_http.dart';

/// How a Food Log row was sourced on the wire (`itemSource` on GET responses).
enum FoodLogEntryItemSource { pantry, referenceFood }

FoodLogEntryItemSource? _tryParseFoodLogItemSource(dynamic raw) {
  if (raw == null) {
    return FoodLogEntryItemSource.pantry;
  }
  if (raw is! String) {
    return null;
  }
  switch (raw) {
    case 'pantry':
      return FoodLogEntryItemSource.pantry;
    case 'reference_food':
      return FoodLogEntryItemSource.referenceFood;
    default:
      return null;
  }
}

String? _optionalNonEmptyWireString(dynamic v) {
  if (v is! String) {
    return null;
  }
  final s = v.trim();
  return s.isEmpty ? null : s;
}

/// One Food Log Entry row as returned by GET `/food-log/entries`.
@immutable
class FoodLogEntryListItem {
  const FoodLogEntryListItem({
    required this.id,
    required this.itemSource,
    required this.displayName,
    required this.iconKey,
    required this.calories,
    required this.proteinGrams,
    required this.fatGrams,
    required this.carbohydratesGrams,
    required this.consumedAt,
    required this.consumedDate,
    required this.quantity,
    required this.servingKind,
    this.pantryItemId,
    this.referenceFoodId,
    this.referenceFoodSource,
    this.referenceSourceFoodId,
    this.servingUnit,
    this.servingCustomLabel,
  });

  final String id;
  final FoodLogEntryItemSource itemSource;
  final String? pantryItemId;
  final String? referenceFoodId;
  final String? referenceFoodSource;
  final String? referenceSourceFoodId;

  /// Display relies on snapshots; callers may omit live reference ids.
  final String displayName;
  final String iconKey;
  final double calories;
  final double proteinGrams;
  final double fatGrams;
  final double carbohydratesGrams;
  final DateTime consumedAt;
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
    final sourceParsed = _tryParseFoodLogItemSource(e['itemSource']);
    if (sourceParsed == null) {
      return null;
    }
    final id = e['id'];
    final name = e['displayName'];
    final icon = e['iconKey'];
    final cal = e['calories'];
    final p = e['proteinGrams'];
    final f = e['fatGrams'];
    final c = e['carbohydratesGrams'];
    final at = e['consumedAt'];
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
        icon is! String ||
        cal is! num ||
        p is! num ||
        f is! num ||
        c is! num ||
        at is! String ||
        d is! String ||
        qty is! num ||
        soRaw == null) {
      return null;
    }
    final consumedAt = DateTime.tryParse(at);
    if (consumedAt == null) {
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
      itemSource: sourceParsed,
      pantryItemId: _optionalNonEmptyWireString(e['pantryItemId']),
      referenceFoodId: _optionalNonEmptyWireString(e['referenceFoodId']),
      referenceFoodSource: _optionalNonEmptyWireString(
        e['referenceFoodSource'],
      ),
      referenceSourceFoodId: _optionalNonEmptyWireString(
        e['referenceSourceFoodId'],
      ),
      displayName: name,
      iconKey: icon.trim().isEmpty ? 'food_bowl' : icon.trim(),
      calories: cal.toDouble(),
      proteinGrams: p.toDouble(),
      fatGrams: f.toDouble(),
      carbohydratesGrams: c.toDouble(),
      consumedAt: consumedAt.toLocal(),
      consumedDate: d,
      quantity: qty.toDouble(),
      servingKind: k,
      servingUnit: servingUnitParsed,
      servingCustomLabel: servingCustomParsed,
    );
  }
}

@immutable
class FoodMacros {
  const FoodMacros({
    required this.calories,
    required this.proteinGrams,
    required this.fatGrams,
    required this.carbohydratesGrams,
  });

  final double calories;
  final double proteinGrams;
  final double fatGrams;
  final double carbohydratesGrams;
}

@immutable
class GroupedFoodLogEntries {
  const GroupedFoodLogEntries({
    required this.consumedAt,
    required this.entries,
  });

  final DateTime consumedAt;
  final List<FoodLogEntryListItem> entries;

  FoodMacros get totalMacros => FoodMacros(
    calories: entries.fold(0, (sum, e) => sum + e.calories),
    proteinGrams: entries.fold(0, (sum, e) => sum + e.proteinGrams),
    fatGrams: entries.fold(0, (sum, e) => sum + e.fatGrams),
    carbohydratesGrams: entries.fold(0, (sum, e) => sum + e.carbohydratesGrams),
  );

  static List<GroupedFoodLogEntries> groupByTime(
    List<FoodLogEntryListItem> items,
  ) {
    bool sameLocalHourMinute(DateTime a, DateTime b) =>
        a.hour == b.hour && a.minute == b.minute;
    final sorted = [...items]
      ..sort((a, b) => a.consumedAt.compareTo(b.consumedAt));
    final groups = <GroupedFoodLogEntries>[];
    for (final item in sorted) {
      if (groups.isEmpty ||
          !sameLocalHourMinute(item.consumedAt, groups.last.consumedAt)) {
        groups.add(
          GroupedFoodLogEntries(consumedAt: item.consumedAt, entries: [item]),
        );
      } else {
        groups.last.entries.add(item);
      }
    }
    return groups;
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

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

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

  Future<void> _selectDay(DateTime day) async {
    setState(() {
      _selectedDay = _dateOnly(day);
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
    final selectedIsToday = _isSameDay(_selectedDay, _dateOnly(DateTime.now()));

    return CustomScrollView(
      physics: const ClampingScrollPhysics(),
      slivers: [
        SliverAppBar(
          pinned: true,
          backgroundColor: scheme.surface,
          toolbarHeight: 72,
          titleSpacing: 16,
          title: Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _formatHeading(_selectedDay),
              style: theme.textTheme.titleLarge?.copyWith(
                color: scheme.onSurface,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(top: 8, right: 12),
              child: TextButton.icon(
                onPressed: !_loading && !selectedIsToday
                    ? () => _selectDay(DateTime.now())
                    : null,
                icon: const Icon(Icons.today_outlined),
                label: const Text('Today'),
              ),
            ),
          ],
        ),
        SliverToBoxAdapter(
          child: _FoodLogDayStrip(
            selectedDay: _selectedDay,
            loading: _loading,
            onDaySelected: _selectDay,
          ),
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
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            sliver: _FoodLogTimeline(entries: _entries),
          ),
      ],
    );
  }
}

class _FoodLogDayStrip extends StatefulWidget {
  const _FoodLogDayStrip({
    required this.selectedDay,
    required this.loading,
    required this.onDaySelected,
  });

  final DateTime selectedDay;
  final bool loading;
  final Future<void> Function(DateTime day) onDaySelected;

  @override
  State<_FoodLogDayStrip> createState() => _FoodLogDayStripState();
}

class _FoodLogDayStripState extends State<_FoodLogDayStrip> {
  final _selectedDayKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _centerSelectedDay());
  }

  @override
  void didUpdateWidget(covariant _FoodLogDayStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_isSameDay(oldWidget.selectedDay, widget.selectedDay)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _centerSelectedDay());
    }
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  void _centerSelectedDay() {
    final context = _selectedDayKey.currentContext;
    if (context == null || !mounted) {
      return;
    }
    Scrollable.ensureVisible(
      context,
      alignment: 0.5,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final days = List<DateTime>.generate(
      7,
      (i) => widget.selectedDay.add(Duration(days: i - 3)),
    );

    return SizedBox(
      height: 100,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        physics: const ClampingScrollPhysics(),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final day = days[index];
          final selected = _isSameDay(day, widget.selectedDay);
          return _FoodLogDayCard(
            key: selected ? _selectedDayKey : null,
            day: day,
            selected: selected,
            enabled: !widget.loading,
            onTap: () => widget.onDaySelected(day),
          );
        },
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemCount: days.length,
      ),
    );
  }
}

class _FoodLogDayCard extends StatelessWidget {
  const _FoodLogDayCard({
    super.key,
    required this.day,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final background = selected ? scheme.primary : scheme.surfaceContainerLow;
    final foreground = selected ? scheme.onPrimary : scheme.onSurface;
    final mutedForeground = selected
        ? scheme.onPrimary.withValues(alpha: 0.82)
        : scheme.onSurfaceVariant;

    return Semantics(
      selected: selected,
      button: true,
      label: DateFormat.yMMMMEEEEd().format(day),
      child: Material(
        color: background,
        elevation: selected ? 6 : 0,
        shadowColor: scheme.primary.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(24),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onTap : null,
          child: SizedBox(
            width: 72,
            height: 100,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    DateFormat.E().format(day).toUpperCase(),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: mutedForeground,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '${day.day}',
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FoodLogTimeline extends StatelessWidget {
  const _FoodLogTimeline({required this.entries});

  final List<FoodLogEntryListItem> entries;

  @override
  Widget build(BuildContext context) {
    final grouped = GroupedFoodLogEntries.groupByTime(entries);
    return SliverList.builder(
      itemCount: grouped.length,
      itemBuilder: (context, index) {
        return _FoodLogTimelineEntry(entry: grouped[index]);
      },
    );
  }
}

class _FoodLogTimelineEntry extends StatelessWidget {
  const _FoodLogTimelineEntry({required this.entry});

  final GroupedFoodLogEntries entry;

  String _timeLabel(GroupedFoodLogEntries group) {
    return DateFormat('h:mm\na').format(entry.consumedAt);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final items = entry.entries;
    final totalMacros = entry.totalMacros;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 32,
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  _timeLabel(entry),
                  textAlign: TextAlign.right,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: scheme.primary,
                    fontWeight: FontWeight.w800,
                    height: 1.05,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          SizedBox(
            width: 18,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Positioned.fill(
                  child: Center(
                    child: VerticalDivider(
                      width: 1,
                      thickness: 1,
                      color: scheme.outlineVariant,
                    ),
                  ),
                ),
                Positioned(
                  top: 8,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: scheme.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: scheme.surface, width: 3),
                    ),
                    child: const SizedBox.square(dimension: 18),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Icon(Icons.local_fire_department_outlined, size: 18),
                      Text(
                        '${totalMacros.calories.round()}',
                        style: theme.textTheme.labelLarge,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${totalMacros.proteinGrams.round()}P',
                        style: theme.textTheme.labelLarge,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${totalMacros.carbohydratesGrams.round()}C',
                        style: theme.textTheme.labelLarge,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${totalMacros.fatGrams.round()}F',
                        style: theme.textTheme.labelLarge,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  for (var i = 0; i < items.length; i++) ...[
                    if (i > 0) const SizedBox(height: 10),
                    _FoodLogEntryCard(entry: items[i]),
                  ],
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ],
      ),
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
    return Material(
      color: scheme.surface,
      elevation: 2,
      shadowColor: scheme.shadow.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(
            color: scheme.outlineVariant.withValues(alpha: 0.5),
          ),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest.withValues(alpha: 0.72),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: SizedBox.square(
                  dimension: 44,
                  child: Center(
                    child: HugeIcon(
                      icon: pantryHugeIconStrokeData(entry.iconKey),
                      size: 25,
                      color: scheme.primary,
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.displayName,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 0),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.local_fire_department_outlined,
                        color: scheme.primary,
                        size: 18,
                      ),

                      Text(
                        '${entry.calories.round()}',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_fmt(entry.proteinGrams)}P',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_fmt(entry.carbohydratesGrams)}C',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_fmt(entry.fatGrams)}F',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                        ),
                      ),

                      const SizedBox(width: 8),
                      Text(
                        entry.consumedServingSummaryLine,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
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
