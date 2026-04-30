import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';

import 'pantry_catalog_icon_map.dart';
import 'pantry_catalog_item.dart';

String _formatMacroGrams(double? v) {
  if (v == null) {
    return '—';
  }
  if (v == v.roundToDouble()) {
    return '${v.toInt()}g';
  }
  return '${v.toStringAsFixed(1)}g';
}

String _caloriesLabel(double? cal) {
  if (cal == null) {
    return '— kcal';
  }
  return '${cal.round()} kcal';
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

  static const double diameter = 26;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surfaceColor,
        shape: BoxShape.circle,
        border: Border.all(color: borderColor),
      ),
      child: SizedBox(
        width: diameter,
        height: diameter,
        child: Center(
          child: HugeIcon(
            icon: pantryHugeIconStrokeData(wireIconKey),
            size: 14,
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

  static const double _slotSize = 48;
  static const double _overlapStep = 14;

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

    final wire = _singleLeadingWireKey(item);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        shape: BoxShape.circle,
      ),
      child: SizedBox(
        width: _slotSize,
        height: _slotSize,
        child: Center(
          child: HugeIcon(
            icon: pantryHugeIconStrokeData(wire),
            size: 26,
            color: scheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

/// Material 3 pantry catalog row: Hugeicons leading tile, highlighted calories,
/// P/C/F macros, optional brand (food only), optional trailing add (food).
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
    final macros =
        'P ${_formatMacroGrams(item.proteinGramsPerBase)} · '
        'C ${_formatMacroGrams(item.carbohydratesGramsPerBase)} · '
        'F ${_formatMacroGrams(item.fatGramsPerBase)}';

    return Material(
      key: ValueKey<String>('pantry-catalog-row-${item.id}'),
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _PantryLeadingVisual(item: item),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      item.name,
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (item.brand != null && item.brand!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        item.brand!,
                        style: text.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      _caloriesLabel(item.caloriesPerBase),
                      style: text.titleSmall?.copyWith(
                        color: scheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      macros,
                      style: text.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    if (item.servingDescriptor != null &&
                        item.servingDescriptor!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        item.servingDescriptor!,
                        style: text.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (onTrailingAddPressed != null) ...<Widget>[
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
    );
  }
}
