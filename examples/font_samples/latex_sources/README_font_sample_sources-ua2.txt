
NOTE ON FONT SAMPLE SOURCES FOR PDF/UA2 and WTPDF.

The font sample pdfs generated with lualatex are compliant with the PDF/A-4f, PDF/UA-2 + tagged pdf, and WTPDF 1.0 accessibility and reuse profiles (https://demo.verapdf.org).  These files also render well in HMTL using  https://ngpdf.com/, with the provided css file.  

These include the following fontsets: Libertinus, Lucida, Heros-stix2, Stix2, Termes-stix2, and Termes.

Relative to the sample thesis in the main directory, only one change was made to obtain UA-2 compliance: Appendix A was omitted because it calls the listings package, which is not currently compatible with tagging (with listings loaded, the file will validate but an error is raised during LaTeX compilation).

Note that the figures used are compatible with PDF/UA2.

The class option lineno is not currently compatible with tagging.


