# Analyzing ST-IAT / IAT data (iatgen workflow)

# {setup} -----------------------------------------------------------------
library(iatgen)
library(tidyverse)

# import and tidy ----------------------------------------------------------
# NOTE: Qualtrics exports sometimes include a first "metadata" row.
# If your file has that extra row, remove it (slice(-1)).

data <- read_csv("stiat_Chelsea_FC.csv", show_col_types = FALSE) %>%
  slice(-1)

# collapse across the 4 counterbalanced permutations -----------------------
# iatgen requires collapsing the four permutations back into:
# compatible practice, compatible critical, incompatible practice, incompatible critical
# using combineIATfourblocks(). :contentReference[oaicite:1]{index=1}

data <- data %>%
  mutate(
    # Critical blocks (compatible vs incompatible)
    compatible_crit   = combineIATfourblocks(Q2.RP2,  Q8.LN4,  Q10.LP2, Q16.RN4),
    incompatible_crit = combineIATfourblocks(Q4.RP4,  Q6.LN2,  Q12.LP4, Q14.RN2),

    # Practice blocks (compatible vs incompatible)
    compatible_prac   = combineIATfourblocks(Q1.RP1,  Q7.LN3,  Q9.LP1,  Q15.RN3),
    incompatible_prac = combineIATfourblocks(Q3.RP3,  Q5.LN1,  Q11.LP3, Q13.RN1)
  )

# clean + score ------------------------------------------------------------
# cleanIAT() implements the Greenwald et al. (2003) D-score logic by default,
# and assumes forced error correction unless you request an error penalty. :contentReference[oaicite:2]{index=2}

clean <- cleanIAT(
  prac1 = data$compatible_prac,
  crit1 = data$compatible_crit,
  prac2 = data$incompatible_prac,
  crit2 = data$incompatible_crit,
  error.penalty = FALSE
)

# Return D values only -----------------------------------------------------
D_scores <- clean$D
D_scores
