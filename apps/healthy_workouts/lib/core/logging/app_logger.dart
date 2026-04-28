import 'package:flutter/foundation.dart';

void logAppMessage(String scope, String message) {
  debugPrint('[${DateTime.now().toIso8601String()}][$scope] $message');
}
