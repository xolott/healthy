import 'package:flutter/material.dart';

import '../../core/navigation/meals_destinations.dart';

class MealsBottomNav extends StatelessWidget {
  const MealsBottomNav({
    super.key,
    required this.currentIndex,
    required this.onDestinationSelected,
  });

  final int currentIndex;
  final ValueChanged<int> onDestinationSelected;


  @override
  Widget build(BuildContext context) {

    return NavigationBar(
      onDestinationSelected: (int index) {
        onDestinationSelected(index);
      },
      selectedIndex: currentIndex,

      destinations: const <Widget>[
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: MealsDestinations.homeLabel,
          key: Key('meals-nav-home'),
        ),
        NavigationDestination(
          icon: Icon(Icons.restaurant_outlined),
          selectedIcon: Icon(Icons.restaurant),
          label: MealsDestinations.foodLogLabel,
          key: Key('meals-nav-journal'),
        ),
        NavigationDestination(
          icon: Icon(Icons.kitchen_outlined),
          selectedIcon: Icon(Icons.kitchen),
          label: MealsDestinations.pantryLabel,
          key: Key('meals-nav-pantry'),
        ),
        NavigationDestination(
          icon: Icon(Icons.trending_up_outlined),
          selectedIcon: Icon(Icons.trending_up),
          label: MealsDestinations.progressLabel,
          key: Key('meals-nav-progress'),
        ),
      ],
    );
  }
}
