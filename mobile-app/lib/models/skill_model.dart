class SkillModel {
  final String id;
  final String name;

  SkillModel({required this.id, required this.name});

  factory SkillModel.fromJson(Map<String, dynamic> json) => SkillModel(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}
