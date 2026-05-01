import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';

import 'pantry_catalog_icon_map.dart';
import 'pantry_catalog_item.dart';

String _formatMacroGrams(double? v) {
  if (v == null) {
    return '—';
  }
  if (v == v.roundToDouble()) {
    return '${v.toInt()}';
  }
  return v.toStringAsFixed(1);
}

String _caloriesLabel(double? cal) {
  if (cal == null) {
    return '—';
  }
  return '${cal.round()}';
}

String _singleLeadingWireKey(PantryCatalogItem item) {
  if (item.ingredientIconKeys.isNotEmpty) {
    return item.ingredientIconKeys.first;
  }
  return item.iconKey;
}

class _IngredientIconBadge extends StatelessWidget {
  const _IngredientIconBadge({
    required this.wireIconKey,
    required this.surfaceColor,
    required this.borderColor,
    required this.iconColor,
  });

  final String wireIconKey;
  final Color surfaceColor;
  final Color borderColor;
  final Color iconColor;

  static const double diameter = 24;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surfaceColor,
        shape: BoxShape.circle,
        border: Border.all(color: borderColor),
      ),
      child: SizedBox.square(
        dimension: diameter,
        child: Center(
          child: HugeIcon(
            icon: pantryHugeIconStrokeData(wireIconKey),
            size: 13,
            color: iconColor,
          ),
        ),
      ),
    );
  }
}

class _PantryLeadingVisual extends StatelessWidget {
  const _PantryLeadingVisual({required this.item});

  final PantryCatalogItem item;

  static const double _slotSize = 42;
  static const double _overlapStep = 13;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final keys = item.ingredientIconKeys;
    final clusterKeys = keys.length > 3 ? keys.sublist(0, 3) : [...keys];

    if (clusterKeys.length >= 2) {
      final n = clusterKeys.length;
      final width = _IngredientIconBadge.diameter + _overlapStep * (n - 1);
      final border = scheme.outline.withValues(alpha: 0.32);
      return Semantics(
        label: 'Top recipe ingredients (${clusterKeys.length} icons)',
        child: SizedBox(
          width: width,
          height: _slotSize,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.centerLeft,
            children: <Widget>[
              for (var i = 0; i < n; i++)
                Positioned(
                  left: i * _overlapStep,
                  top: (_slotSize - _IngredientIconBadge.diameter) / 2,
                  child: _IngredientIconBadge(
                    wireIconKey: clusterKeys[i],
                    surfaceColor: scheme.surfaceContainerHighest,
                    borderColor: border,
                    iconColor: scheme.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        shape: BoxShape.circle,
      ),
      child: SizedBox.square(
        dimension: _slotSize,
        child: Center(
          child: HugeIcon(
            icon: pantryHugeIconStrokeData(_singleLeadingWireKey(item)),
            size: 23,
            color: scheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

/// Material 3 pantry catalog row with a compact nutrition summary.
class PantryCatalogListTile extends StatelessWidget {
  const PantryCatalogListTile({
    super.key,
    required this.item,
    required this.onTap,
    this.onTrailingAddPressed,
  });

  final PantryCatalogItem item;
  final VoidCallback onTap;
  final VoidCallback? onTrailingAddPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final brand = item.brand?.trim();
    final servingDescriptor = item.servingDescriptor?.trim();

    return Material(
      key: ValueKey<String>('pantry-catalog-row-${item.id}'),
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: scheme.outlineVariant.withValues(alpha: 0.7),
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                _PantryLeadingVisual(item: item),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text.rich(
                        TextSpan(
                          children: <InlineSpan>[
                            TextSpan(text: item.name),
                            if (brand != null && brand.isNotEmpty)
                              TextSpan(
                                text: ' by $brand',
                                style: TextStyle(
                                  color: scheme.onSurfaceVariant.withValues(
                                    alpha: 0.68,
                                  ),
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                          ],
                        ),
                        style: text.titleLarge?.copyWith(
                          color: scheme.onSurface,
                          fontSize: 18,
                          fontWeight: FontWeight.w400,
                          height: 1.1,
                          letterSpacing: 0.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      _NutritionLine(
                        calories: _caloriesLabel(item.caloriesPerBase),
                        protein: _formatMacroGrams(item.proteinGramsPerBase),
                        carbohydrates: _formatMacroGrams(
                          item.carbohydratesGramsPerBase,
                        ),
                        fat: _formatMacroGrams(item.fatGramsPerBase),
                        servingDescriptor:
                            servingDescriptor != null &&
                                servingDescriptor.isNotEmpty
                            ? servingDescriptor
                            : null,
                      ),
                    ],
                  ),
                ),
                if (onTrailingAddPressed != null) ...<Widget>[
                  const SizedBox(width: 12),
                  IconButton.filledTonal(
                    key: ValueKey<String>('pantry-catalog-row-add-${item.id}'),
                    onPressed: onTrailingAddPressed,
                    tooltip: 'Add',
                    icon: const Icon(Icons.add),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NutritionLine extends StatelessWidget {
  const _NutritionLine({
    required this.calories,
    required this.protein,
    required this.carbohydrates,
    required this.fat,
    this.servingDescriptor,
  });

  final String calories;
  final String protein;
  final String carbohydrates;
  final String fat;
  final String? servingDescriptor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final baseStyle = theme.textTheme.titleMedium?.copyWith(
      color: scheme.onSurfaceVariant,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      height: 1,
    );
    final calorieStyle = baseStyle?.copyWith(
      color: scheme.primary,
      fontWeight: FontWeight.w400,
    );
    final servingStyle = baseStyle?.copyWith(
      color: scheme.onSurfaceVariant.withValues(alpha: 0.82),
      fontStyle: FontStyle.italic,
    );
    final gap = 8.0;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: <Widget>[
          Icon(
            Icons.local_fire_department_outlined,
            color: scheme.primary,
            size: 18,
          ),

          Text(calories, style: calorieStyle),
          SizedBox(width: gap),
          Text('${protein}P', style: baseStyle),
          SizedBox(width: gap),
          Text('${carbohydrates}C', style: baseStyle),
          SizedBox(width: gap),
          Text('${fat}F', style: baseStyle),
          if (servingDescriptor != null) ...<Widget>[
            SizedBox(width: gap),
            SizedBox(
              height: 18,
              child: VerticalDivider(
                color: scheme.outlineVariant,
                thickness: 1.5,
                width: 2,
              ),
            ),
            SizedBox(width: gap),
            Text(servingDescriptor!, style: servingStyle),
          ],
        ],
      ),
    );
  }
}
