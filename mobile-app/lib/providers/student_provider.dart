import 'package:flutter/foundation.dart';
import '../core/services/api_service.dart';
import '../core/constants/api.dart';
import '../models/student_model.dart';
import '../models/skill_model.dart';

class StudentProvider extends ChangeNotifier {
  StudentModel? _student;
  bool _isLoading = false;
  String? _error;

  StudentModel? get student => _student;
  bool get isLoading => _isLoading;
  bool get hasProfile => _student != null;
  String? get error => _error;
  List<SkillModel> _availableSkills = [];
  List<SkillModel> get availableSkills => _availableSkills;

  final _api = ApiService();

  Future<void> fetchProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final resp = await _api.get(ApiConstants.profile);
      _student = StudentModel.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      _error = 'Profile not found';
      _student = null;
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> saveProfile(Map<String, dynamic> profileData) async {
    _isLoading = true;
    notifyListeners();
    try {
      await _api.post(ApiConstants.profile, data: profileData);
      await fetchProfile();
      return true;
    } catch (e) {
      _error = 'Failed to save profile';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> fetchSkills() async {
    try {
      final resp = await _api.get(ApiConstants.skills);
      final List data = resp.data;
      _availableSkills = data.map((e) => SkillModel.fromJson(e)).toList();
      notifyListeners();
    } catch (_) {}
  }

  // ── Internships ─────────────────────────────────────────────────────────────
  Future<bool> addInternship(Map<String, dynamic> data) async {
    try {
      await _api.post(ApiConstants.internships, data: data);
      await fetchProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> updateCertificate(String internshipId, String url) async {
    try {
      await _api.patch(ApiConstants.internshipCertificate(internshipId),
          data: {'certificate_url': url});
      await fetchProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> deleteInternship(String id) async {
    try {
      await _api.delete(ApiConstants.internshipDelete(id));
      await fetchProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Projects ────────────────────────────────────────────────────────────────
  Future<bool> addProject(Map<String, dynamic> data) async {
    try {
      await _api.post(ApiConstants.projects, data: data);
      await fetchProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> updateProject(String id, Map<String, dynamic> data) async {
    try {
      await _api.put('${ApiConstants.projects}/$id', data: data);
      await fetchProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> updateThumbnail(String projectId, String url) async {
    try {
      await _api.patch(ApiConstants.projectThumbnail(projectId),
          data: {'thumbnail_url': url});
      await fetchProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> deleteProject(String id) async {
    try {
      await _api.delete(ApiConstants.projectDelete(id));
      await fetchProfile();
      return true;
    } catch (_) {
      return false;
    }
  }
}
