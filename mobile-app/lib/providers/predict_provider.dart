import 'package:flutter/foundation.dart';
import '../core/services/api_service.dart';
import '../core/constants/api.dart';
import '../models/prediction_model.dart';

class PredictProvider extends ChangeNotifier {
  PredictResult? _result;
  bool _isLoading = false;
  String? _error;

  PredictResult? get result => _result;
  bool get isLoading => _isLoading;
  String? get error => _error;

  final _api = ApiService();

  Future<void> predict() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final resp = await _api.get(ApiConstants.predict);
      _result = PredictResult.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      _error = 'Could not run prediction. Make sure your profile is complete.';
    }
    _isLoading = false;
    notifyListeners();
  }

  void clear() {
    _result = null;
    _error = null;
    notifyListeners();
  }
}
