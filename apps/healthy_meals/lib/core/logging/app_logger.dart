import 'package:flutter/foundation.dart';

/// Minimal structured logging shim. Extend in later iterations when needed.
void logAppMessage(String scope, String message) {
  debugPrint('[${DateTime.now().toIso8601String()}][$scope] $message');
}
