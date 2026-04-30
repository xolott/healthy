import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'pantry_catalog_item.dart';
import 'pantry_fab_scope.dart';
import 'pantry_infinite_catalog_list.dart';

class PantryRecipeTabContent extends StatelessWidget {
  const PantryRecipeTabContent({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = PantryFabScope.maybeOf(context);
    return PantryInfiniteCatalogList(
      itemType: PantryCatalogItemType.recipe,
      reloadSignal: scope?.recipeCatalogRevision,
      searchFieldKey: const Key('pantry-recipe-items-search'),
      searchHint: 'Search recipes by name...',
      emptyMessage:
          'No recipes yet. Saved items appear here once you add them.',
      noMatchesMessage: 'No recipes match your search.',
      onTapItem: (ctx, item) {
        ctx.push('/pantry/recipe/${item.id}');
      },
    );
  }
}
