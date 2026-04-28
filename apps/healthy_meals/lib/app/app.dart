import 'package:flutter/material.dart';

import 'router.dart';
import 'theme/app_theme.dart';

class HealthyMealsApp extends StatelessWidget {
  const HealthyMealsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Healthy Meals',
      theme: MealsAppTheme.light(),
      routerConfig: mealsRouter,
    );
  }
}
