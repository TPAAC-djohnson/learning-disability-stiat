# Load iatgen
library(iatgen)

# Generate Learning Disability ST-IAT
writeSCIATfull(
  
  # --- Basic Naming ---
  IATname = "Learning Disability ST-IAT (Test)",
  posname = "Learning Disability",     # Single target label
  Aname   = "Pleasant",                # Attribute A
  Bname   = "Unpleasant",              # Attribute B
  
  # --- Stimulus Types ---
  catType = "words",                   # Attribute stimuli type
  tgtType = "words",                   # Target stimuli type
  
  # --- Target Stimuli (Learning Disability) ---
  poswords = c(
    "Learning Disability",
    "Dyslexia",
    "Dyscalculia",
    "Reading Disorder",
    "Processing Disorder",
    "Learning Difference",
    "Special Education"
  ),
  
  # --- Pleasant Attribute Words ---
  Awords = c(
    "Joy",
    "Love",
    "Peace",
    "Success",
    "Pleasure",
    "Wonderful",
    "Excellent"
  ),
  
  # --- Unpleasant Attribute Words ---
  Bwords = c(
    "Failure",
    "Pain",
    "Terrible",
    "Horrible",
    "Nasty",
    "Awful",
    "Disaster"
  ),
  
  # --- Recommended ST-IAT Trial Structure ---
  n = c(24, 48, 24, 48),   # practice / critical / reversed practice / critical
  
  # --- Output Options ---
  qsf = TRUE,              # generate Qualtrics file
  note = TRUE,
  
  # --- Error Handling ---
  correct.error = TRUE,    # force correction before moving on
  pause = 250,             # inter-trial interval
  errorpause = 300,        # ignored when correct.error = TRUE
  
  # --- Display Settings ---
  tgtCol = "black",
  catCol = "green"
)
