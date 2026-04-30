import 'package:flutter/material.dart';

class MealsHomeScreen extends StatefulWidget {
  const MealsHomeScreen({super.key});

  @override
  State<MealsHomeScreen> createState() => _MealsHomeScreenState();
}

class _MealsHomeScreenState extends State<MealsHomeScreen> {
  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          backgroundColor: Theme.of(context).colorScheme.surface,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Good morning,',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              Row(
                children: const [
                  Text(
                    'Jose Truyol',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  SizedBox(width: 4),
                  Text('👋', style: TextStyle(fontSize: 20)),
                ],
              ),
            ],
          ),
          actionsPadding: const EdgeInsets.symmetric(horizontal: 12),
          actions: [
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              style: IconButton.styleFrom(shape: const CircleBorder()),
              onPressed: () {},
            ),
          ],
        ),
      ],
    );
  }
}
