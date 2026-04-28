import 'package:flutter/material.dart';

import 'router.dart';
import 'theme/app_theme.dart';

class HealthyWorkoutsApp extends StatelessWidget {
  const HealthyWorkoutsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Healthy Workouts',
      theme: WorkoutsAppTheme.light(),
      routerConfig: workoutsRouter,
    );
  }
}
