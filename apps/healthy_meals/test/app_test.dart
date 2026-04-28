import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:healthy_meals/app/app.dart';

void main() {
  testWidgets('Healthy Meals boots with startup gate', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: HealthyMealsApp(),
      ),
    );
    await tester.pump();

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
