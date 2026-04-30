import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:intl/intl.dart';

import 'meals_food_log_shell_sync.dart';
import 'pantry_catalog_helpers.dart';
import 'pantry_catalog_item.dart';
import 'pantry_http.dart';
import 'pantry_infinite_catalog_list.dart';

/// Composer: log one Pantry Food as a Food Log Entry (base foods or foods with
/// predefined/custom serving options).
class MealsFoodLogEntryComposerScreen extends StatefulWidget {
  const MealsFoodLogEntryComposerScreen({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<MealsFoodLogEntryComposerScreen> createState() =>
      _MealsFoodLogEntryComposerScreenState();
}

class _MealsFoodLogEntryComposerScreenState
    extends State<MealsFoodLogEntryComposerScreen> {
  late DateTime _consumedAt;
  final TextEditingController _quantityController = TextEditingController(
    text: '1',
  );
  PantryCatalogItem? _food;
  int _selectedServingIndex = 0;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final day = mealsFoodLogSelectedDayNotifier.value;
    _consumedAt = DateTime(
      day.year,
      day.month,
      day.day,
      now.hour,
      now.minute,
      now.second,
    );
  }

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  double? _parseQuantity() {
    final raw = _quantityController.text.trim();
    final v = double.tryParse(raw);
    if (v == null || v <= 0 || v.isNaN || v.isInfinite) {
      return null;
    }
    return v;
  }

  bool _hasValidServingSelection(PantryCatalogItem food) {
    final opts = food.foodServingOptions;
    if (opts.isEmpty) {
      return true;
    }
    return _selectedServingIndex >= 0 && _selectedServingIndex < opts.length;
  }

  Map<String, dynamic>? _servingOptionWire(PantryCatalogItem food) {
    final opts = food.foodServingOptions;
    if (opts.isEmpty) {
      return <String, dynamic>{'kind': 'base'};
    }
    if (!_hasValidServingSelection(food)) {
      return null;
    }
    return opts[_selectedServingIndex].toServingOptionWire();
  }

  ({double cal, double protein, double carbs, double fat})? _draftTotals() {
    final f = _food;
    final q = _parseQuantity();
    if (f == null || q == null) {
      return null;
    }
    final baseG = f.baseAmountGrams;
    final c = f.caloriesPerBase;
    final p = f.proteinGramsPerBase;
    final carb = f.carbohydratesGramsPerBase;
    final fat = f.fatGramsPerBase;
    if (baseG == null ||
        c == null ||
        p == null ||
        carb == null ||
        fat == null) {
      return null;
    }

    final double consumedGramsTotal;
    final opts = f.foodServingOptions;
    if (opts.isEmpty) {
      consumedGramsTotal = baseG * q;
    } else {
      if (!_hasValidServingSelection(f)) {
        return null;
      }
      consumedGramsTotal = opts[_selectedServingIndex].gramsPerServing * q;
    }

    return foodLogNutrientsForConsumedGrams(
      baseAmountGrams: baseG,
      caloriesPerBase: c,
      proteinPerBase: p,
      carbohydratesPerBase: carb,
      fatPerBase: fat,
      consumedGramsTotal: consumedGramsTotal,
    );
  }

  Future<String> _resolveBaseUrl() async {
    final base = await ApiBaseUrlStore.read();
    return base?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  Future<void> _pickDateTime() async {
    if (!mounted) {
      return;
    }
    final d = await showDatePicker(
      context: context,
      initialDate: _dateOnly(_consumedAt),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (d == null || !mounted) {
      return;
    }
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_consumedAt),
    );
    if (t == null || !mounted) {
      return;
    }
    setState(() {
      _consumedAt = DateTime(d.year, d.month, d.day, t.hour, t.minute);
    });
  }

  DateTime _dateOnly(DateTime x) => DateTime(x.year, x.month, x.day);

  Future<void> _openFoodPicker() async {
    final picked = await Navigator.of(context).push<PantryCatalogItem>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => const _FoodLogPantryFoodPickerPage(),
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        _food = picked;
        _selectedServingIndex = 0;
      });
    }
  }

  Future<void> _save() async {
    final food = _food;
    final qty = _parseQuantity();
    if (food == null ||
        qty == null ||
        _saving ||
        !_hasValidServingSelection(food)) {
      return;
    }
    final serving = _servingOptionWire(food);
    if (serving == null) {
      return;
    }
    final base = await _resolveBaseUrl();
    final token = await readSessionToken();
    if (!mounted) {
      return;
    }
    if (base.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Server URL is not configured.')),
      );
      return;
    }
    if (token == null || token.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Not signed in.')));
      return;
    }
    setState(() => _saving = true);
    final uri = Uri.parse('$base/food-log/entries/batch');
    final bodyMap = <String, dynamic>{
      'consumedAt': _consumedAt.toIso8601String(),
      'consumedDate': DateFormat('yyyy-MM-dd').format(_consumedAt),
      'entries': <Map<String, dynamic>>[
        {'pantryItemId': food.id, 'quantity': qty, 'servingOption': serving},
      ],
    };
    try {
      final res = await PantryHttp.post(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(bodyMap),
      );
      if (!mounted) {
        return;
      }
      setState(() => _saving = false);
      if (res.statusCode == 201) {
        widget.onDone();
        return;
      }
      var msg = 'Could not save entry.';
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) {
          final m = decoded['message'];
          if (m is String && m.isNotEmpty) {
            msg = m;
          }
        }
      } catch (_) {}
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Could not save entry.')));
      }
    }
  }

  static String _fmtNut(num? v) {
    if (v == null) {
      return '—';
    }
    if (v == v.roundToDouble()) {
      return '${v.toInt()}';
    }
    return v.toStringAsFixed(1);
  }

  static String _formatQuantityForSummary(String raw) {
    final t = raw.trim();
    if (t.isEmpty) {
      return '—';
    }
    final v = double.tryParse(t);
    if (v == null) {
      return t;
    }
    if (v == v.roundToDouble()) {
      return '${v.toInt()}';
    }
    return v.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final food = _food;
    final totals = _draftTotals();
    final canSave =
        food != null &&
        _parseQuantity() != null &&
        !_saving &&
        _hasValidServingSelection(food) &&
        totals != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('New entry'),
        actions: [
          TextButton(
            onPressed: canSave ? _save : null,
            child: _saving
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: scheme.primary,
                    ),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('When'),
            subtitle: Text(DateFormat.yMMMd().add_jm().format(_consumedAt)),
            trailing: const Icon(Icons.edit_calendar_outlined),
            onTap: _pickDateTime,
          ),
          const Divider(),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Food'),
            subtitle: Text(
              food == null
                  ? 'Choose from your Pantry'
                  : food.brand != null && food.brand!.isNotEmpty
                  ? '${food.name} · ${food.brand}'
                  : food.name,
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: _openFoodPicker,
          ),
          if (food != null && food.foodServingOptions.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Serving', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            InputDecorator(
              key: const Key('food-log-composer-serving'),
              decoration: const InputDecoration(border: OutlineInputBorder()),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<int>(
                  isExpanded: true,
                  menuMaxHeight: 320,
                  value: _selectedServingIndex.clamp(
                    0,
                    food.foodServingOptions.length - 1,
                  ),
                  items: [
                    for (var i = 0; i < food.foodServingOptions.length; i++)
                      DropdownMenuItem<int>(
                        value: i,
                        child: Text(
                          food.foodServingOptions[i].pickerDisplayLabel,
                        ),
                      ),
                  ],
                  onChanged: (v) {
                    if (v == null) {
                      return;
                    }
                    setState(() => _selectedServingIndex = v);
                  },
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            key: const Key('food-log-composer-quantity'),
            controller: _quantityController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: food != null && food.foodServingOptions.isNotEmpty
                  ? 'Quantity (servings)'
                  : 'Quantity (base servings)',
              border: const OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 24),
          Text('Summary', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          if (food == null)
            Text(
              'Select a food to see nutrition.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            )
          else ...[
            if (!_hasValidServingSelection(food))
              Text(
                'Choose a valid serving.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.error,
                ),
              )
            else if (food.servingDescriptor != null)
              Text(
                'Per ${food.servingDescriptor}: '
                '${_fmtNut(food.caloriesPerBase)} kcal · '
                'P ${_fmtNut(food.proteinGramsPerBase)} g · '
                'C ${_fmtNut(food.carbohydratesGramsPerBase)} g · '
                'F ${_fmtNut(food.fatGramsPerBase)} g',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            const SizedBox(height: 12),
            if (totals != null) ...[
              Text(
                'Totals for '
                '${_formatQuantityForSummary(_quantityController.text)} '
                '${food.foodServingOptions.isEmpty ? 'base serving(s)' : 'serving unit(s)'}, '
                'scaled by your choice.',
                style: theme.textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              Text(
                '${totals.cal.round()} kcal total',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Protein ${_fmtNut(totals.protein)} g · '
                'Carbs ${_fmtNut(totals.carbs)} g · '
                'Fat ${_fmtNut(totals.fat)} g',
                style: theme.textTheme.bodyLarge,
              ),
            ] else
              Text(
                'Nutrition data is incomplete for this food.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.error,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _FoodLogPantryFoodPickerPage extends StatelessWidget {
  const _FoodLogPantryFoodPickerPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const Key('food-log-food-picker'),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Choose food'),
      ),
      body: SafeArea(
        child: PantryInfiniteCatalogList(
          itemType: PantryCatalogItemType.food,
          searchFieldKey: const Key('food-log-picker-search'),
          searchHint: 'Search foods by name or brand...',
          emptyMessage: 'No foods yet. Add foods in Pantry before logging.',
          noMatchesMessage: 'No foods match your search.',
          onTapItem: (ctx, item) {
            Navigator.of(ctx).pop(item);
          },
        ),
      ),
    );
  }
}
