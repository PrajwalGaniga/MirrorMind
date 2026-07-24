class InternshipModel {
  final String id;
  final String companyName;
  final String domain;
  final String role;
  final DateTime startDate;
  final DateTime? endDate;
  final bool isCurrent;
  final String? certificateUrl;
  final String? description;

  InternshipModel({
    required this.id,
    required this.companyName,
    required this.domain,
    required this.role,
    required this.startDate,
    this.endDate,
    required this.isCurrent,
    this.certificateUrl,
    this.description,
  });

  factory InternshipModel.fromJson(Map<String, dynamic> json) => InternshipModel(
        id: json['id'] as String,
        companyName: json['company_name'] as String,
        domain: json['domain'] as String,
        role: json['role'] as String,
        startDate: DateTime.parse(json['start_date'] as String),
        endDate: json['end_date'] != null ? DateTime.parse(json['end_date'] as String) : null,
        isCurrent: (json['is_current'] as int?) == 1,
        certificateUrl: json['certificate_url'] as String?,
        description: json['description'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'company_name': companyName,
        'domain': domain,
        'role': role,
        'start_date': startDate.toIso8601String(),
        'end_date': endDate?.toIso8601String(),
        'is_current': isCurrent ? 1 : 0,
        'certificate_url': certificateUrl,
        'description': description,
      };
}
