import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:intl/intl.dart';

import '../../core/navigation/meals_destinations.dart';
import 'pantry_http.dart';

/// Food Log tab: loads Food Log Entries for a selected local calendar day.
class MealsFoodLogDayScreen extends StatefulWidget {
  const MealsFoodLogDayScreen({super.key});

  @override
  State<MealsFoodLogDayScreen> createState() => _MealsFoodLogDayScreenState();
}

class _MealsFoodLogDayScreenState extends State<MealsFoodLogDayScreen> {
  late DateTime _selectedDay;
  bool _loading = true;
  String? _error;
  bool _hasEntries = false;

  @override
  void initState() {
    super.initState();
    _selectedDay = _dateOnly(DateTime.now());
    _load();
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
        _hasEntries = false;
      });
      return;
    }
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Not signed in.';
        _hasEntries = false;
      });
      return;
    }
    final uri = Uri.parse('$base/food-log/entries').replace(
      queryParameters: {'date': _toApiDate(_selectedDay)},
    );
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
          _hasEntries = false;
        });
        return;
      }
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) {
        setState(() {
          _loading = false;
          _error = 'Unable to load Food Log.';
          _hasEntries = false;
        });
        return;
      }
      final raw = body['entries'];
      final count = raw is List<dynamic> ? raw.length : 0;
      setState(() {
        _loading = false;
        _error = null;
        _hasEntries = count > 0;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Unable to load Food Log.';
        _hasEntries = false;
      });
    }
  }

  Future<void> _shiftDay(int delta) async {
    setState(() {
      _selectedDay = _dateOnly(_selectedDay.add(Duration(days: delta)));
    });
    await _load();
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
        else if (!_hasEntries)
          SliverFillRemaining(
            hasScrollBody: false,
            child: _FoodLogEmptyDay(dayLabel: _formatHeading(_selectedDay)),
          )
        else
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Entries for this day will appear here.',
                  style: theme.textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
      ],
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
            Icon(
              Icons.restaurant_outlined,
              size: 56,
              color: scheme.primary,
            ),
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
