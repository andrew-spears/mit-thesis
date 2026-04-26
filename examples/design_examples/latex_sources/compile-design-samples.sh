#! /bin/bash



# MIT-Thesis_redsans_headings_UA2
lualatex MIT-Thesis_redsans_headings_UA2
biber    MIT-Thesis_redsans_headings_UA2
lualatex MIT-Thesis_redsans_headings_UA2
lualatex MIT-Thesis_redsans_headings_UA2


# MIT-Thesis_libertinus_headings_UA2
lualatex MIT-Thesis_libertinus_headings_UA2
biber    MIT-Thesis_libertinus_headings_UA2
lualatex MIT-Thesis_libertinus_headings_UA2
lualatex MIT-Thesis_libertinus_headings_UA2


# clean up

#mkdir pdffiles
#mv *.pdf pdffiles
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