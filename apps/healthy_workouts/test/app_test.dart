import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:healthy_workouts/app/app.dart';

void main() {
  testWidgets('Healthy Workouts boots with startup gate', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: HealthyWorkoutsApp(),
      ),
    );
    await tester.pump();

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
