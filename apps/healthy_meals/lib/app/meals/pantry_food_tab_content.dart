import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'pantry_catalog_item.dart';
import 'pantry_fab_scope.dart';
import 'pantry_infinite_catalog_list.dart';

class PantryFoodTabContent extends StatelessWidget {
  const PantryFoodTabContent({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = PantryFabScope.maybeOf(context);
    return PantryInfiniteCatalogList(
      itemType: PantryCatalogItemType.food,
      reloadSignal: scope?.foodCatalogRevision,
      searchFieldKey: const Key('pantry-food-items-search'),
      searchHint: 'Search foods by name or brand...',
      emptyMessage: 'No foods yet. Saved items appear here once you add them.',
      noMatchesMessage: 'No foods match your search.',
      onTapItem: (ctx, item) {
        ctx.push('/pantry/food/${item.id}');
      },
    );
  }
}
