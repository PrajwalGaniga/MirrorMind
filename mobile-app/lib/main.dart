import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/constants/api.dart';
import 'core/services/api_service.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/student_provider.dart';
import 'providers/predict_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/main/main_scaffold.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  ApiService().init(ApiConstants.baseUrl);
  runApp(const MirrorMindApp());
}

class MirrorMindApp extends StatelessWidget {
  const MirrorMindApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => StudentProvider()),
        ChangeNotifierProvider(create: (_) => PredictProvider()),
      ],
      child: MaterialApp(
        title: 'MirrorMind',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.theme,
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.isLoggedIn) return const MainScaffold();
        return const LoginScreen();
      },
    );
  }
}
