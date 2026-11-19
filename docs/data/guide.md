# Site Guide — Activity Detective

## Purpose
This exhibit lets visitors guess a person's activity from 2.56 seconds of smartphone acceleration data, then compare their guess with a neural network's prediction.

## Data
UCI Human Activity Recognition Using Smartphones (Anguita et al., 2013), CC BY 4.0. 30 volunteers aged 19–48 wore a Samsung Galaxy S II on the waist. Six activities: walking, walking upstairs, walking downstairs, sitting, standing, laying. Signals were recorded at 50 readings per second and cut into 2.56-second windows (128 readings). The dataset comes pre-split by person: 21 people for training (7,352 windows) and 9 different people for testing (2,947 windows), so the model is always tested on people it never saw.

## Model
Inputs: the 561 ready-made summary features provided with the dataset (averages, peaks, frequencies, etc. from each window). Output: one of the six activities.
Model: a scikit-learn neural network (MLPClassifier) with two hidden layers (128 and 64 neurons), features standardized using training data only, and early stopping using a slice of the training data.
The charts on this site show the raw acceleration (x, y, z) so visitors can see the movement; the model itself used the 561 features.

## Results (test set, 9 unseen people)
- Baseline (always guess the most common training activity, LAYING): about 18% accuracy.
- Neural network: about 94% accuracy.
- Most common mistakes: sitting predicted as standing (51), standing predicted as sitting (31), walking downstairs predicted as upstairs (26), walking upstairs predicted as walking (20).

## Highlighted mistake
Walking upstairs is sometimes predicted as walking. Both have a steady step rhythm of about one step every half second. Stairs tend to show smoother, lower peaks. A barometer (to sense altitude change), longer windows, or data from more people might help.

## Limitations
- Only 30 people, all adults aged 19–48, in a lab setting, with the phone in a fixed position on the waist.
- Results may not hold for other ages, other phone positions (pocket, hand), other devices, or real-world conditions.
- The model was not tested on any other dataset.
- This is an educational exhibit, not a medical or fitness device.

## Frequently asked questions
- Where did the data come from? From the UCI Human Activity Recognition Using Smartphones dataset (Anguita et al., 2013, CC BY 4.0): 30 volunteers wearing a Samsung Galaxy S II on the waist.
- How did the model compare with the baseline? The baseline (always guessing LAYING) scored about 18% accuracy. The neural network scored about 94% accuracy on 9 people it never saw.
- How well does the model work on other datasets? Unknown. It was never tested on any other dataset, so we cannot say.
