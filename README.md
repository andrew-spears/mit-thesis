  
  #mitthesis --- A LaTeX template for an MIT thesis#

  v1.22 dated 2026/01/31

  ####Overview####
  This class provides a LaTeX template to format an MIT thesis according to
  the requirements of the Massachusetts Institute of Technology Libraries (as posted in 2026):
  
  [https://libraries.mit.edu/distinctive-collections/thesis-specs/](https://libraries.mit.edu/distinctive-collections/thesis-specs/)

  This template is appropriate for MIT theses of all types.
  
  This template works with either pdfLaTeX or unicode engines such as luaLaTeX. The bibliography can be prepared with either biblatex (default) or natbib/bibtex. The class is requires LaTeX distributions of TeX Live 2022 or later. This template replaces the older version of mitthesis.cls, which was first composed in the 1980s.
  
  With minor adjustments, this template can be adapted for use at other institutions (see the documentation for details).

  The files in this distribution are:

          README.md             --  this file
          mitthesis.cls         --  the class file
          MIT-Thesis.pdf        --  a sample thesis from the template, using default fonts
          *
          MIT-thesis-template/  --  a directory with the files needed to starting writing your thesis
              MIT-Thesis.tex        --  the main latex template file for this class
              abstract.tex          --  put your abstract in this file
              acknowledgments.tex   --  put your acknowledgments in this file
              biosketch.tex         --  put your biosketch in this file (optional)
              chapter1.tex          --  sample first chapter 
              appendixa.tex         --  sample appendix with code listing
              appendixb.tex         --  sample appendix with multipage table
              mitthesis-sample.bib  --  a sample bibliography file with many examples
              mitthesis-style.css   --  a css style file embedded when tagged pdf is in use
              mydesign.tex          --  an optional file to load packages for document design
              fontsets/             --  a subdirectory of input files that load optional fonts
          *
          mitthesis-doc/        --  documentation for usage and options
          examples/cover_page_samples/  
                                --  sample theses for one or more authors and degrees (PDF/UA2 and WTPDF)
          examples/design_samples/  
                                --  examples of modifying the typographic design (PDF/UA2 and WTPDF)
          examples/font_samples/  
                                --  sample theses in different fonts (most are PDF/UA2 and WTPDF)
          
    
  ####Author####
  
  John H. Lienhard V
  
  Department of Mechanical Engineering
          
  Massachusetts Institute of Technology
          
  Cambridge, MA 02139-4307 USA


 ---
 
 ####Change log####
 v1.22 (31 January 2026)
 - Extensive revision of mitthesis-style.css and related tagging for improved html appearance. 
 - Some structures tagged with a user-defined namespace.
 - Eliminate subfigure package. Add class-defined \\subfigure and \\subcaption.
 - Caption package now loaded only optionally through separate "mydesign" files.
 - Edit mydesign.tex to use recent sockets/plugs for styling caption labels. As shipped, caption labels are made bold.
 - Include patches for caption package, when loaded, to prevent breakage of tagging.
 - Add period after each previous degree as a semantic of-end-sentence; the nonsemantic “\\linebreak” doesn't translate to html.
 - Ensure no comma after first author name of two in copyright authors string
 - Fix \\setoperatorfont in the Lucida fontset
 - Adjust width of longtable captions
 - Limit \\mathversion{bold} in section headings to fontsets that actually have a bold \\mathversion. Related edits in mydesign files.
 - Regenerate example files and edit documentation
 - Test backward compatibility in pdftex and lualatex to TeX Live 2022.

 v1.21 (2 November 2025)
 - drop most compatibility code for distributions older than TeX Live 2022.
 - automatically create committee members page if at least one \\Reader command is given
 - add an optional third field to the \\Supervisor macro (necessary with committee members page)
 - revise code allow multiple titles/departments for supervisors and others
 - fix bug in abstract-supervisor block that led to infinite loop for three or more supervisors.
 - fix bug in handling edge cases of M degrees from N departments, where M and N are not equal and M + N > 3 
 - add Oxford comma to copyright authors list
 - change new column type in App B to eliminate warning about duplicate d column definition
 - rescaled math font (Stix2) in heros-stix2 fontset file    
 - patch biblatex (in mitthesis.tex) to make the number field vanish if value is empty or missing
 - attach css file to improve HTML rendering when tagpdf is in use
 - add Strong tag to Title, Abstract Title, and “Abstract” for better HTML rendering
 - change abstract supervisor block to a tabular environment for better HTML spacing
 - tagged table header-rows in Table 1.1
 - in in Table 1.1, replaced \\\\\[-0.5em\] by \\vspace{0.5em} to avoid tagging an empty line
 - drop two tagging patches, now that those issues are fixed in current latex release
 - set unicode-math to \[mathbf=sym\], to get bold math from symbol font, not default text font, in unicode fontset files. Prevents the loss of bold math symbols in HTML conversion.
 - regenerate all example pdfs, mainly as UA-2, A-4F, and WTPDF; drop separate UA-2 examples directory
 - revise documentation, validated for UA-2, A-4F, WTPDF, and CSS
 - extensive code editing to better match expl3 syntactical conventions
 - eliminate local integer counters in favor of \\l\_tmpa\_int, etc.

 v1.20 (2 May 2025)
 - add font sample files in PDF/UA2 format. These files validate with https://demo.verapdf.org/ (v1.28.1) including the PDF/UA2 + tagged PDF profile, and the WTPDF 1.0 accessibility and reuse profiles.
 - define a two-column nomenclature format (nomenclature\*), using multicol package; set \\@itempenalty=10000 in \\EntryHeading
 - changes to default article reference format; change citation format to omit space after commas (\[6,7\] not \[6, 7\]).
 - eliminate Nx and cx argument types in favor of Ne and ce (x-type arguments are now deprecated); change some hooks; various other changes to the class file code.
 - extensive changes to committee\_members.tex (sample committee page), to accommodate tagpdf.
 - extensively test backward compatibility; 2022/11/01 \LaTeX is now the recommended minimum version, but class is backward compatible to mid-2021 \LaTeX format.
 - various revisions to fontset files, including opentype font comments and removal of +ss03 from Inconsolatazi4 (upright quote option). 
 - several minor changes in chapter1.tex, mostly related to mathematics.
 - recode class option \[mydesign\] as a key value option; provide two examples of design-modifying files that can load this way.
 - various code improvements; add additional accommodations for tagged pdf and html conversion
 - correct headings in Table 1.1 for error that slipped in with v1.17.
 - update and edit documentation; eliminate hologo package from documentation; update nomenclature code in documentation

 v1.19 (28 January 2025)
 - stop default loading of titlesec package, add \\mathversion{bold} with \\patchcmd instead, to preserve tags
 - add temporary patches (tagging related) for caption with lof/lot and for large delimiters in some fonts
 - further adjustments to tagging code (passim)
 - fix minor bug in chapter1.tex
 - edit documentation

 v1.18 (17 January 2025)
 - remove “In:” from references to journal papers
 - edits to title and abstract macros to better accommodate tagged pdf
 - replace tabbing environment in titlepage signature block by tabular and adjust centering code
 - add additional tags to title and abstract page for better structure
 - regenerate sample cover pages as PDF2/UA-2 with lualatex, also adding microtype
 - add fourth optional argument to nomenclature environment to control its style in toc
 - in chapter1.tex, replace MWE figures in pdf by jpg, to support validation as PDF2/UA-2
 - fix minor typos in documentation and update
  
 v1.17 (2 November 2024)
 - change default copyright to All Rights Reserved rather than Creative Commons 
 - define mathoperators for erf and erfc
 - modification of dcolumn in Appendix B to use text font for figures
 - edit documentation and committee_members.tex
 - protect punctuation in titles for transfer to xmp metadata
 - replace libertine fontset by libertinus fontset
 - add lmodern fontset
 - extensive edits to fira-newtxsf fontset file: rescale firasans, change typewriter font, use tabular lining figures, use text font for math operators
 - adjust font sizes in hero-stix2, termes, and termes-stix fontset files
 - update font sample files
 - ensure \cs_gset:Npe is defined, for backward compatibility
 - change some link targets in frontmatter and nomenclature, for future tagged pdf
 
 v1.16 (06 September 2024)
 - Same as v1.15, but now with the correct version of MIT-Thesis.tex
 
 v1.15 (31 August 2024)
 - add an example for the longtable package (App. B)
 - add sample Thesis Committee page (optional)
 - load microtype package, enable tracking for capitalized strings (degree name[s], institution name)
 - fix typo in MIT-Thesis.tex
 - edit documentation
 - edit pdfauthor string to separator authors with semicolon, not comma (per Dublin Core recommendation)
 - define \\@author and \\@title in case needed
 
 v1.14 (19 July 2024)
 -  add backward compatibility code for \\text\_titlecase\_all:n
 -  adjust supervisor and acceptor titles used on sample cover pages
 -  format J/psi as \\symbfit in sample chapter 1 and regenerate font samples
 -  edit documentation
 
 v1.13 (03 July 2024)
 -  same as v1.12, except now includes the correct documentation
 
 v1.12 (02 July 2024)
 -  add logic for one degree issued by two departments
 -  fix missing space in abstract block for multiple departments
 -  adjust second department layout on title and abstract pages
 -  table of contents revised
 -  revise documentation
 -  switch default citation style to numeric (from IEEE).  Provide examples for IEEE and author/year styles.
 - 	add \\AtEndPreamble{..} to mitthesis-newtx-sans-text.tex to accommodate v1.731 of newtx
 -  in chapter1.tex, replace \\text by \\textrm; fix nested link in section heading
 -  remove obsolete hyperref option from xcolor
 -  minor changes to log notes of fontset files
 -  code clean up
 
 v1.11 (02 November 2023)
 - revise all skips on cover page to better group material while allowing for glue compression as content increases; increase font size of author name; provide user macros for control cover page spacing and author name font.
 - use \\mdseries for linenumbers in all cases, rather than using the locally active series
 - remove \\raggedright in favor of \\bibsetup for bibliography in MIT-Thesis.tex 
 - add backward compatibility for alt tag of \\includegraphics for pre-2021/11/15 distributions, add alt tag in chapter1.tex
 - edit all occurrences of \\addcontentsline
 - rearrange eqn:WT1 in chapter1.tex to avoid margin overflow with some fonts, eliminate associated work-around.
 - edit tab:1 and increase space below caption; edit fig:golden
 - edit nomenclature environment to better accommodate [future] tagged pdf
 - remove vertical [1em] after final \\Acceptor (thanks to Gustav Pettersson)
 - edit documentation

 v1.10 (23 September 2023)
 - Minor edit of documentation

 v1.09 (22 September 2023)
 - Revise documentation
 - Minor code clean-up
 
 v1.08 (11 September 2023):
 - accommodate recent changes in hyperxmp package (used when \\DocumentMetadata is not called)
 - various minor edits
 
 v1.07 (04 September 2023):
 - Improve handling of custom fontset files; move fontset directory into MIT-thesis-template directory
 - Remove unnecessary latex code
 - Move hyperlink and line number color choices to mydesign.tex
 - Enable some backward compatibility in expl3 code
 - Edit documentation
  
 v1.06 (29 August 2023):
 - Extensive revision of class file, with most code converted to expl3.  Significant streamlining of remaining LaTeX2e code. Minor changes to user interface. No changes to format or design of thesis.
 - Add user macros \\CopyrightAuthor, \\DegreeMonth, \\DegreeYear, and \\Institution{..}
 - Drop user macros \\CCurl, \\PDFRightsText, and \\MIT{..}
 - Reduce volume of pdf metadata required to be added by user
 - Accommodate author names that end with a period or include a comma (e.g., Martin Luther King, Jr.) or end in a capital letter (e.g., King Charles III).
 - Reduce font size in fira-newtxsf fontset
 - Update documentation
 
 v1.05 (21 July 2023): 
 - Fix bug in toc page number affecting some lists of figures or tables (note: for backward compatibility, remove code in .tex file around \\tableofcontents, \\listoffigures, and \\listoftables so that your code will match the present version)
 - Include thesis submission date in abstract, remove previous degrees from abstract page, and allow May for degree month, per MIT Libraries
 - Fill pdflicenseurl in class file; update a class warning message
 - Clean-up documentation and code

 v1.04 (3 July 2023): 
 - Embed default fontset in class file, in case fontset directory is missing

 v1.03 (26 June 2023): 
 - Bug fix: fontset naming for older LaTeX formats
 - Change default biblatex style to IEEE
 - Code hacks for non-MIT use of template (see documentation, pg. 7)

 v1.02 (23 June 2023): 
 - Bug fixes: triple major counter, \\SignatureBlockSize
 - Code revisions for cover page and abstract pages: spacing, linebreaking, and user command options
  
 v1.01 (19 June 2023): Changes to file structure and naming
 
 v1.00 (17 June 2023): Initial release
 
 ---
 
 ####License####

 Copyright (c) 2026 John H. Lienhard

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and 
 associated documentation files (the "Software"), to deal in the Software without restriction, 
 including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
 subject to the following two conditions:

 The above copyright notice and this permission notice shall be included in all copies or 
 substantial portions of the Software.

 The software is provided "as is", without warranty of any kind, express or implied, including but 
 not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. 
 In no event shall the authors or copyright holders be liable for any claim, damages or other liability, 
 whether in an action of contract, tort or otherwise, arising from, out of or in connection with the 
 software or the use or other dealings in the software.
