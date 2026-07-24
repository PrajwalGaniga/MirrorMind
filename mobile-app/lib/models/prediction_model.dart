class PredictionModel {
  final int rank;
  final String role;
  final String label;
  final double confidence;

  PredictionModel({
    required this.rank,
    required this.role,
    required this.label,
    required this.confidence,
  });

  factory PredictionModel.fromJson(Map<String, dynamic> json) => PredictionModel(
        rank: json['rank'] as int,
        role: json['role'] as String,
        label: json['label'] as String,
        confidence: (json['confidence'] as num).toDouble(),
      );
}

class PredictResult {
  final String studentId;
  final String name;
  final String branch;
  final double cgpa;
  final List<PredictionModel> predictions;
  final Map<String, dynamic> skillRadar;
  final String topInsight;

  PredictResult({
    required this.studentId,
    required this.name,
    required this.branch,
    required this.cgpa,
    required this.predictions,
    required this.skillRadar,
    required this.topInsight,
  });

  factory PredictResult.fromJson(Map<String, dynamic> json) => PredictResult(
        studentId: json['student_id'] as String,
        name: json['name'] as String,
        branch: json['branch'] as String,
        cgpa: (json['cgpa'] as num).toDouble(),
        predictions: (json['predictions'] as List)
            .map((e) => PredictionModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        skillRadar: (json['skill_radar'] as Map<String, dynamic>?) ?? {},
        topInsight: json['top_insight'] as String? ?? '',
      );
}
