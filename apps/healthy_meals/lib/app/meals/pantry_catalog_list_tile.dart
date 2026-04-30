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

String _leadingIconWireKey(PantryCatalogItem item) {
  if (item.ingredientIconKeys.isNotEmpty) {
    return item.ingredientIconKeys.first;
  }
  return item.iconKey;
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
              DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest,
                  shape: BoxShape.circle,
                ),
                child: SizedBox(
                  width: 48,
                  height: 48,
                  child: Center(
                    child: HugeIcon(
                      icon: pantryHugeIconStrokeData(_leadingIconWireKey(item)),
                      size: 26,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
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
