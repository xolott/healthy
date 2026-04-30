import 'package:flutter/material.dart';

import 'pantry_fab_scope.dart';
import 'pantry_food_tab_content.dart';
import 'pantry_recipe_tab_content.dart';

class MealsPantryCatalogScreen extends StatefulWidget {
  const MealsPantryCatalogScreen({super.key});

  @override
  State<MealsPantryCatalogScreen> createState() =>
      _MealsPantryCatalogScreenState();
}

class _MealsPantryCatalogScreenState extends State<MealsPantryCatalogScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_publishPantryTabToShell);
  }

  void _publishPantryTabToShell() {
    if (_tabController.indexIsChanging) {
      return;
    }
    PantryFabScope.maybeOf(context)?.tabIndexListenable.value =
        _tabController.index;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    PantryFabScope.maybeOf(context)?.tabIndexListenable.value =
        _tabController.index;
  }

  @override
  void dispose() {
    _tabController
      ..removeListener(_publishPantryTabToShell)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TabBar(
              controller: _tabController,
              tabs: const [
                Tab(key: Key('pantry-tab-food-top'), text: 'Foods'),
                Tab(key: Key('pantry-tab-recipe-top'), text: 'Recipes'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: const [
                  PantryFoodTabContent(),
                  PantryRecipeTabContent(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
