import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../core/constants/api.dart';
import '../core/services/api_service.dart';
import '../models/settings_model.dart';

class SettingsProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  ApiKeyModel? _apiKey;
  bool _isLoading = false;
  String? _newRawKey;
  String? _error;
  String? _success;

  ApiKeyModel? get apiKey => _apiKey;
  bool get isLoading => _isLoading;
  String? get newRawKey => _newRawKey;
  String? get error => _error;
  String? get success => _success;

  void clearNewKey() {
    _newRawKey = null;
    _error = null;
    _success = null;
    notifyListeners();
  }

  Future<void> fetchApiKey() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.get(ApiConstants.settingsApiKey);
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        _apiKey = ApiKeyModel.fromJson(res.data as Map<String, dynamic>);
      }
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Failed to fetch API key.';
    } catch (e) {
      _error = 'Error fetching API key: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> generateApiKey() async {
    _isLoading = true;
    _error = null;
    _success = null;
    notifyListeners();

    try {
      final res = await _api.post(ApiConstants.settingsApiKey);
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        _newRawKey = res.data['raw_key'];
        _success = 'API Key created successfully! Copy it now.';
        await fetchApiKey();
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Failed to create API key.';
      return false;
    } catch (e) {
      _error = 'Error creating API key: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> regenerateApiKey(String password) async {
    _isLoading = true;
    _error = null;
    _success = null;
    notifyListeners();

    try {
      final res = await _api.post(
        ApiConstants.settingsApiKeyRegenerate,
        data: {'password': password},
      );
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        _newRawKey = res.data['raw_key'];
        _success = 'API Key regenerated successfully! Copy it now.';
        await fetchApiKey();
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['detail'] ?? 'Failed to regenerate API key.';
      return false;
    } catch (e) {
      _error = 'Error regenerating API key: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
