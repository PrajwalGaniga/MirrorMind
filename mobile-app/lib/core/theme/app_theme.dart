import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // ── Color Palette ──────────────────────────────────────────────────────────
  static const Color canvas = Color(0xFFECE8E6);
  static const Color cardWhite = Color(0xFFFFFFFF);
  static const Color borderBlack = Color(0xFF111111);
  static const Color textPrimary = Color(0xFF111111);
  static const Color textBody = Color(0xFF3A3A3A);
  static const Color textCaption = Color(0xFF6B6B6B);

  // Pastel accents
  static const Color lavender = Color(0xFFDCC8FF);
  static const Color mint = Color(0xFFCFF3B2);
  static const Color peach = Color(0xFFFFDCA8);
  static const Color softRed = Color(0xFFFFB7B7);
  static const Color skyBlue = Color(0xFFB8E4FF);

  // ── Box Shadow ─────────────────────────────────────────────────────────────
  static List<BoxShadow> cardShadow = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.12),
      offset: const Offset(4, 4),
      blurRadius: 0,
    ),
  ];

  static List<BoxShadow> cardShadowPressed = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.12),
      offset: const Offset(2, 2),
      blurRadius: 0,
    ),
  ];

  // ── Border ─────────────────────────────────────────────────────────────────
  static const Border cardBorder = Border.fromBorderSide(
    BorderSide(color: borderBlack, width: 3),
  );

  static BorderRadius cardRadius = BorderRadius.circular(24);
  static BorderRadius buttonRadius = BorderRadius.circular(14);
  static BorderRadius tagRadius = BorderRadius.circular(8);

  // ── Text Styles ────────────────────────────────────────────────────────────
  static TextStyle heading1(BuildContext context) =>
      GoogleFonts.inter(fontSize: 32, fontWeight: FontWeight.w700, color: textPrimary, height: 1.2);

  static TextStyle heading2(BuildContext context) =>
      GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w700, color: textPrimary);

  static TextStyle sectionTitle(BuildContext context) =>
      GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: textPrimary);

  static TextStyle cardTitle(BuildContext context) =>
      GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary);

  static TextStyle body(BuildContext context) =>
      GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: textBody);

  static TextStyle caption(BuildContext context) =>
      GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: textCaption);

  static TextStyle metric(BuildContext context) =>
      GoogleFonts.inter(fontSize: 32, fontWeight: FontWeight.w700, color: textPrimary);

  static TextStyle navLabel(BuildContext context) =>
      GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600);

  // ── Theme Data ─────────────────────────────────────────────────────────────
  static ThemeData get theme => ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: canvas,
        colorScheme: const ColorScheme.light(
          primary: lavender,
          secondary: mint,
          surface: cardWhite,
          onPrimary: textPrimary,
          onSurface: textPrimary,
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: canvas,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: textPrimary,
          ),
          iconTheme: const IconThemeData(color: textPrimary),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: lavender,
            foregroundColor: textPrimary,
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: borderBlack, width: 3),
            ),
            elevation: 0,
            textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: textPrimary,
            minimumSize: const Size(double.infinity, 48),
            side: const BorderSide(color: borderBlack, width: 3),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: cardWhite,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: borderBlack, width: 3),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: borderBlack, width: 3),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: borderBlack, width: 3),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: softRed, width: 3),
          ),
          hintStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: textCaption),
          labelStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: textCaption),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: cardWhite,
          selectedColor: lavender,
          side: const BorderSide(color: borderBlack, width: 2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      );
}
