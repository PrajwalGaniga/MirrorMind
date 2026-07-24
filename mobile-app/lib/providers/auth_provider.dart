import 'package:flutter/foundation.dart';
import '../core/services/api_service.dart';
import '../core/constants/api.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isLoading = false;
  String? _error;

  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _user != null;
  String? get error => _error;

  final _api = ApiService();

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final resp = await _api.post(ApiConstants.login,
          data: {'email': email, 'password': password});
      final data = resp.data as Map<String, dynamic>;
      await _api.saveToken(data['token'] as String);
      _user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String name, String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final resp = await _api.post(ApiConstants.register,
          data: {'name': name, 'email': email, 'password': password});
      final data = resp.data as Map<String, dynamic>;
      await _api.saveToken(data['token'] as String);
      _user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseError(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> updateAvatar(String avatarUrl) async {
    try {
      await _api.patch(ApiConstants.avatar, data: {'avatar_url': avatarUrl});
      _user = UserModel(
        id: _user!.id,
        name: _user!.name,
        email: _user!.email,
        avatarUrl: avatarUrl,
      );
      notifyListeners();
    } catch (_) {}
  }

  void logout() {
    _user = null;
    _api.clearToken();
    notifyListeners();
  }

  String _parseError(dynamic e) {
    try {
      final resp = (e as dynamic).response;
      if (resp != null) {
        final detail = resp.data['detail'];
        if (detail != null) return detail.toString();
      }
    } catch (_) {}
    return 'Something went wrong. Check your connection.';
  }
}
