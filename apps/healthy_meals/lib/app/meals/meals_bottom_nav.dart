import 'package:flutter/material.dart';

import '../../core/navigation/meals_destinations.dart';

/// Bottom bar: Home, Food Log, raised center Plus, Pantry, Progress.
class MealsBottomNav extends StatelessWidget {
  const MealsBottomNav({
    super.key,
    required this.currentIndex,
    required this.onDestinationSelected,
    required this.onCenterPlus,
  });

  final int currentIndex;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onCenterPlus;

  static const _inactiveColor = Color(0xFF6B7280);
  static const _activeColor = Color(0xFFF97316);
  static const _fabColor = Color(0xFFF97316);

  @override
  Widget build(BuildContext context) {
    const barHeight = 64.0;
    const fabSize = 56.0;
    const fabOverhang = 20.0;

    return SizedBox(
      height: barHeight + fabOverhang,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Material(
              elevation: 8,
              color: Theme.of(context).colorScheme.surface,
              child: SizedBox(
                height: barHeight,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Expanded(
                        child: _NavTile(
                          icon: Icons.home_outlined,
                          label: MealsDestinations.homeLabel,
                          selected: currentIndex == 0,
                          activeColor: _activeColor,
                          inactiveColor: _inactiveColor,
                          onTap: () => onDestinationSelected(0),
                          testKey: const Key('meals-nav-home'),
                        ),
                      ),
                      Expanded(
                        child: _NavTile(
                          icon: Icons.restaurant_outlined,
                          label: MealsDestinations.foodLogLabel,
                          selected: currentIndex == 1,
                          activeColor: _activeColor,
                          inactiveColor: _inactiveColor,
                          onTap: () => onDestinationSelected(1),
                          testKey: const Key('meals-nav-journal'),
                        ),
                      ),
                      const SizedBox(width: fabSize + 8),
                      Expanded(
                        child: _NavTile(
                          icon: Icons.kitchen_outlined,
                          label: MealsDestinations.pantryLabel,
                          selected: currentIndex == 2,
                          activeColor: _activeColor,
                          inactiveColor: _inactiveColor,
                          onTap: () => onDestinationSelected(2),
                          testKey: const Key('meals-nav-pantry'),
                        ),
                      ),
                      Expanded(
                        child: _NavTile(
                          icon: Icons.trending_up_outlined,
                          label: MealsDestinations.progressLabel,
                          selected: currentIndex == 3,
                          activeColor: _activeColor,
                          inactiveColor: _inactiveColor,
                          onTap: () => onDestinationSelected(3),
                          testKey: const Key('meals-nav-progress'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: -(fabOverhang),
            child: Material(
              shape: const CircleBorder(),
              elevation: 6,
              color: _fabColor,
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                key: const Key('meals-fab-food-log'),
                onTap: onCenterPlus,
                customBorder: const CircleBorder(),
                child: SizedBox(
                  width: fabSize,
                  height: fabSize,
                  child: const Icon(
                    Icons.add,
                    color: Colors.white,
                    size: 30,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.activeColor,
    required this.inactiveColor,
    required this.onTap,
    required this.testKey,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final Color activeColor;
  final Color inactiveColor;
  final VoidCallback onTap;
  final Key testKey;

  @override
  Widget build(BuildContext context) {
    final color = selected ? activeColor : inactiveColor;
    return InkWell(
      onTap: onTap,
      child: Semantics(
        selected: selected,
        button: true,
        label: label,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 24, key: testKey),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: color,
                      fontSize: 10,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
