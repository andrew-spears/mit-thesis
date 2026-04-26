#! /bin/bash

# Default fonts
pdflatex Defaultfonts_sample
biber    Defaultfonts_sample
pdflatex Defaultfonts_sample
biber    Defaultfonts_sample
pdflatex Defaultfonts_sample

# Fira_Newtxsf
pdflatex Fira_Newtxsf_sample
biber    Fira_Newtxsf_sample
pdflatex Fira_Newtxsf_sample
biber    Fira_Newtxsf_sample
pdflatex Fira_Newtxsf_sample

# Libertinus
lualatex Libertinus_sample
biber    Libertinus_sample
lualatex Libertinus_sample
biber    Libertinus_sample
lualatex Libertinus_sample
lualatex Libertinus_sample
lualatex Libertinus_sample

# Lmodern
lualatex Lmodern_sample
biber    Lmodern_sample
lualatex Lmodern_sample
biber    Lmodern_sample
lualatex Lmodern_sample
lualatex Lmodern_sample
lualatex Lmodern_sample

# Lucida
lualatex Lucida_sample
biber    Lucida_sample
lualatex Lucida_sample
biber    Lucida_sample
lualatex Lucida_sample
lualatex Lucida_sample
lualatex Lucida_sample

# Newtx-sans-text
pdflatex Newtx-sans-text_sample
biber    Newtx-sans-text_sample
pdflatex Newtx-sans-text_sample
biber    Newtx-sans-text_sample
pdflatex Newtx-sans-text_sample

# Newtx
pdflatex Newtx_sample
biber    Newtx_sample
pdflatex Newtx_sample
biber    Newtx_sample
pdflatex Newtx_sample

# Heros-Stix2
lualatex Heros-Stix2_sample
biber    Heros-Stix2_sample
lualatex Heros-Stix2_sample
biber    Heros-Stix2_sample
lualatex Heros-Stix2_sample
lualatex Heros-Stix2_sample
lualatex Heros-Stix2_sample

# Stix2
lualatex Stix2_sample
biber    Stix2_sample
lualatex Stix2_sample
biber    Stix2_sample
lualatex Stix2_sample
lualatex Stix2_sample
lualatex Stix2_sample

# Termes-stix2
lualatex Termes-stix2_sample
biber    Termes-stix2_sample
lualatex Termes-stix2_sample
biber    Termes-stix2_sample
lualatex Termes-stix2_sample
lualatex Termes-stix2_sample
lualatex Termes-stix2_sample

# Termes
lualatex Termes_sample
biber    Termes_sample
lualatex Termes_sample
biber    Termes_sample
lualatex Termes_sample
lualatex Termes_sample
lualatex Termes_sample


# clean up

# mkdir pdffiles
# mv *.pdf pdffiles
mv *.pdf ../
rm *.aux
rm *.bbl
rm *.bcf
rm *.blg
rm *.log
rm *.lot
rm *.lof
rm *.toc
rm *.xml
rm *-mathml.html
