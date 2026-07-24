import 'internship_model.dart';
import 'project_model.dart';

class StudentModel {
  final String id;
  final String userId;
  final String name;
  final String branch;
  final int semester;
  final String collegeTier;
  final int backlogCount;
  final List<String> skills;
  final List<String> certifications;
  final String careerInterest;
  final int communicationRating;
  final String workStylePref;
  final double cgpa;
  final int projectsCount;
  final int internshipCount;
  final String? avatarUrl;
  final List<InternshipModel> internships;
  final List<ProjectModel> projects;
  final List<dynamic> semesterRecords;
  final dynamic predictions;

  StudentModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.branch,
    required this.semester,
    required this.collegeTier,
    required this.backlogCount,
    required this.skills,
    required this.certifications,
    required this.careerInterest,
    required this.communicationRating,
    required this.workStylePref,
    required this.cgpa,
    required this.projectsCount,
    required this.internshipCount,
    this.avatarUrl,
    required this.internships,
    required this.projects,
    required this.semesterRecords,
    this.predictions,
  });

  factory StudentModel.fromJson(Map<String, dynamic> json) => StudentModel(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        name: json['name'] as String,
        branch: json['branch'] as String,
        semester: json['semester'] as int,
        collegeTier: json['college_tier'] as String,
        backlogCount: json['backlog_count'] as int,
        skills: (json['skills'] as List?)?.map((e) => e.toString()).toList() ?? [],
        certifications: (json['certifications'] as List?)?.map((e) => e.toString()).toList() ?? [],
        careerInterest: json['career_interest'] as String,
        communicationRating: json['communication_rating'] as int,
        workStylePref: json['work_style_pref'] as String,
        cgpa: (json['cgpa'] as num?)?.toDouble() ?? 0.0,
        projectsCount: json['projects_count'] as int? ?? 0,
        internshipCount: json['internship_count'] as int? ?? 0,
        avatarUrl: json['avatar_url'] as String?,
        internships: (json['internships'] as List?)
                ?.map((e) => InternshipModel.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        projects: (json['projects'] as List?)
                ?.map((e) => ProjectModel.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        semesterRecords: (json['semester_records'] as List?) ?? [],
        predictions: json['predictions'],
      );
}
