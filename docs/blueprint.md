# **App Name**: QuizArena

## Core Features:

- AI Quiz Question Generator: Utilize a generative AI tool to assist hosts in creating quizzes by suggesting questions, alternative answers, and suitable time limits based on a provided topic or theme.
- Interactive Quiz Authoring: Enable administrators to create, edit, save, and manage quizzes by defining titles, descriptions, questions, four alternatives, correct answers, time limits, and base scores, storing all data in Firestore.
- Real-time Live Game Hosting: Allow hosts to initiate a live quiz session, generate a unique 6-digit PIN, monitor connected players, display the current question with a timer, and view real-time response statistics, leveraging Firestore for state management.
- Live Game Player Experience: Provide a responsive, mobile-optimized interface for players to join a live game using a PIN, submit answers to questions, and view immediate feedback, partial rankings, and the final podium, with data synchronization via Firestore.
- Permanent Challenge Publishing: Enable hosts to publish completed quizzes as asynchronous challenges, generating a unique, shareable public URL for ongoing user participation, with quiz data stored in Firestore.
- Asynchronous Challenge Play & Scoring: Allow users to play published challenges by entering a nickname, answer questions, receive a score based on the specified formula, and record their results and performance in Firestore.
- Dynamic Global Leaderboards: Display a sortable and filterable global ranking for challenge modes (e.g., Top 10, Today, This Month), showing player scores, accuracy, and total time, all powered by data queried from Firestore.

## Style Guidelines:

- Primary color: A deep, engaging purple-blue (#5A33CC), selected to convey intelligence and a modern digital feel while standing out against the light background. This hue (260) balances playfulness with focus.
- Background color: A subtle, very light purple-grey (#F4F0F7), visibly of the same hue as the primary color but heavily desaturated to provide a clean and calming canvas, enhancing readability for text and maintaining brand cohesion.
- Accent color: A vibrant, clear blue (#458EF2), chosen as an analogous color to the primary (hue 230). Its higher saturation and brightness create a distinct contrast, perfect for interactive elements, calls to action, and emphasizing key information during gameplay or rankings, promoting an energetic and competitive vibe.
- Headlines: 'Space Grotesk' (sans-serif) for a modern, techy, and bold statement. Body text: 'Inter' (sans-serif) for exceptional readability across various screen sizes and detailed content like quiz descriptions and instructions.
- Use a set of clear, contemporary icons that convey actions and statuses intuitively. Incorporate playful yet professional iconography to represent gamification elements like achievements, rankings, and quiz categories, consistent with a Kahoot-inspired aesthetic.
- Implement a responsive, mobile-first layout with clean lines, generous white space, and clear hierarchy, ensuring optimal user experience on both desktop (for hosts) and mobile devices (for players). Maximize information density without feeling cluttered.
- Utilize subtle yet engaging animations for transitions between questions, visual feedback on submitted answers, progress indicators, and dynamic updates to leaderboards to enhance the interactive and gamified experience without causing distraction.