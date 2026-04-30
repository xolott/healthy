import 'package:flutter/material.dart';

import '../../core/config/app_identity.dart';
import '../../core/navigation/meals_destinations.dart';

class MealsHomePlaceholder extends StatelessWidget {
  const MealsHomePlaceholder({super.key});

  @override
  Widget build(BuildContext context) {
    return _PlaceholderBody(
      title: MealsDestinations.homeLabel,
      message:
          'Welcome to ${AppIdentity.title}.\n\nHome is a placeholder while dashboard work lands in a later slice.',
    );
  }
}

class MealsPantryPlaceholder extends StatelessWidget {
  const MealsPantryPlaceholder({super.key});

  @override
  Widget build(BuildContext context) {
    return const _PlaceholderBody(
      title: MealsDestinations.pantryLabel,
      message: 'Pantry catalog functionality will arrive in the next implementation slice.',
    );
  }
}

class MealsProgressPlaceholder extends StatelessWidget {
  const MealsProgressPlaceholder({super.key});

  @override
  Widget build(BuildContext context) {
    return const _PlaceholderBody(
      title: MealsDestinations.progressLabel,
      message: 'Progress is a placeholder while trends and goals are defined for Meals.',
    );
  }
}

class _PlaceholderBody extends StatelessWidget {
  const _PlaceholderBody({
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
      ),
    );
  }
}
