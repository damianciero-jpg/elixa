/**
 * Elixa - React Native / Expo
 * Rebuilt with Firebase (Auth + Firestore + Storage) and Claude AI
 *
 * AI chat calls go through your backend endpoint (see api/elixa-chat.js).
 * Set EXPO_PUBLIC_API_BASE_URL in your .env to point at that server.
 */

import React, { createContext, useContext, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Linking,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// ─── Firebase ────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ─── Firebase config — replace with your project values ──────────────────────
// Tip: use react-native-dotenv or expo-constants to inject these at build time.
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            || 'YOUR_API_KEY',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || 'YOUR_AUTH_DOMAIN',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || 'YOUR_PROJECT_ID',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || 'YOUR_APP_ID',
};

const firebaseApp  = initializeApp(firebaseConfig);
const auth         = getAuth(firebaseApp);
const db           = getFirestore(firebaseApp);
const storage      = getStorage(firebaseApp);

// ─── Backend URL for Claude AI proxy ─────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function callClaudeBackend(messages, mode) {
  const res = await fetch(`${API_BASE}/api/elixa-chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages, mode }),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const data = await res.json();
  return data.reply;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();

// ─── Shared app context (authenticated state) ─────────────────────────────────
const AppContext = createContext(null);

// ─── Shared UI components ─────────────────────────────────────────────────────
function BackButton({ navigation, target = 'Home' }) {
  return (
    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
      <Text style={styles.backText}>← {target}</Text>
    </TouchableOpacity>
  );
}

function Header({ title, subtitle }) {
  return (
    <View style={styles.header}>
      <Text style={styles.logo}>Elixa</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#85A7FF" size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!authUser) {
    return <AuthScreen onAuth={setAuthUser} />;
  }

  return <MainApp authUser={authUser} />;
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let cred;
      if (mode === 'signup') {
        cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Create Firestore profile doc
        await setDoc(doc(db, 'profiles', cred.user.uid), {
          email: email.trim(),
          preferred_tone: 'calm',
          created_at: serverTimestamp(),
        });
      } else {
        cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onAuth(cred.user);
    } catch (e) {
      setError(e.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.logoLarge}>Elixa</Text>
        <Text style={styles.heroText}>
          {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
        </Text>
        <Text style={styles.heroSub}>Private support during difficult moments.</Text>

        <TextInput
          style={styles.authInput}
          placeholder="Email"
          placeholderTextColor="#8C96B3"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.authInput}
          placeholder="Password"
          placeholderTextColor="#8C96B3"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text style={styles.primaryText}>{mode === 'login' ? 'Sign In' : 'Sign Up'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          <Text style={styles.footerLinkText}>
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main App — state provider + navigator ────────────────────────────────────
function MainApp({ authUser }) {
  const [checkins, setCheckins] = useState([]);
  const [futureMessages, setFutureMessages] = useState([]);
  const [progress, setProgress] = useState({ intentionalDays: 0, avgUrge: 0, avgOverwhelm: 0 });
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const uid = authUser.uid;

        // Load check-ins
        const ciSnap = await getDocs(
          query(collection(db, 'checkins'), where('user_id', '==', uid), orderBy('created_at', 'desc'))
        );
        const ciData = ciSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCheckins(ciData);

        // Load future-self messages
        const fsSnap = await getDocs(
          query(collection(db, 'future_self_messages'), where('user_id', '==', uid), orderBy('created_at', 'desc'))
        );
        setFutureMessages(fsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Compute progress stats from loaded check-ins
        updateProgress(ciData);
      } catch (e) {
        console.warn('Data load error:', e.message);
      } finally {
        setDataLoaded(true);
      }
    }
    loadData();
  }, [authUser.uid]);

  function updateProgress(ciData) {
    const intentionalDays = ciData.filter(c => {
      if (c.impulse_outcome) return c.impulse_outcome !== 'gave_in';
      return !c.drank_today;
    }).length;
    const avgUrge = ciData.length
      ? Math.round(ciData.reduce((s, c) => s + (c.urge || 0), 0) / ciData.length)
      : 0;
    const avgOverwhelm = ciData.length
      ? Math.round(ciData.reduce((s, c) => s + (c.metrics?.overwhelm || c.overwhelm || 0), 0) / ciData.length)
      : 0;
    setProgress({ intentionalDays, avgUrge, avgOverwhelm });
  }

  async function addCheckin(checkin) {
    const uid = authUser.uid;
    const newCI = {
      user_id: uid,
      ...checkin,
      created_at: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'checkins'), newCI);
    const updated = [{ id: docRef.id, ...newCI, created_at: new Date() }, ...checkins];
    setCheckins(updated);
    updateProgress(updated);
  }

  async function addFutureMessage(text) {
    const uid = authUser.uid;
    const newMsg = {
      user_id:      uid,
      message:      text,
      message_type: 'text',
      created_at:   serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'future_self_messages'), newMsg);
    setFutureMessages([{ id: docRef.id, ...newMsg, created_at: new Date() }, ...futureMessages]);
  }

  if (!dataLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#85A7FF" size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <AppContext.Provider value={{ authUser, checkins, futureMessages, progress, addCheckin, addFutureMessage }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home"       component={HomeScreen} />
          <Stack.Screen name="Emergency"  component={EmergencyScreen} />
          <Stack.Screen name="Support"    component={SupportScreen} />
          <Stack.Screen name="CheckIn"    component={CheckInScreen} />
          <Stack.Screen name="FutureSelf" component={FutureSelfScreen} />
          <Stack.Screen name="Progress"   component={ProgressScreen} />
          <Stack.Screen name="Safety"              component={SafetyScreen} />
          <Stack.Screen name="EmergencyResources" component={EmergencyResourcesScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppContext.Provider>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ navigation }) {
  const { progress } = useContext(AppContext);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.logoLarge}>Elixa</Text>
        <Text style={styles.heroText}>Private support during difficult moments.</Text>
        <Text style={styles.heroSub}>
          A calm place to pause, breathe, and get through the next 10 minutes.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Emergency')}>
          <Text style={styles.primaryText}>I'm struggling right now</Text>
        </TouchableOpacity>

        <View style={styles.cardRow}>
          <TouchableOpacity style={styles.smallCard} onPress={() => navigation.navigate('CheckIn')}>
            <Text style={styles.cardTitle}>Check In</Text>
            <Text style={styles.cardText}>Mood, energy, urges</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallCard} onPress={() => navigation.navigate('FutureSelf')}>
            <Text style={styles.cardTitle}>Future Self</Text>
            <Text style={styles.cardText}>Your own reasons</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.fullCard} onPress={() => navigation.navigate('Progress')}>
          <Text style={styles.cardTitle}>Progress</Text>
          <Text style={styles.cardText}>
            {progress.intentionalDays} intentional days · {progress.avgUrge}/10 average urge
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Safety')}>
          <Text style={styles.footerLinkText}>Safety and support information</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerLink, { marginTop: 12 }]}
          onPress={() => signOut(auth)}
        >
          <Text style={[styles.footerLinkText, { color: '#8C96B3' }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Emergency Screen ─────────────────────────────────────────────────────────
function EmergencyScreen({ navigation }) {
  const [urge, setUrge] = useState(6);

  function startMode(mode) {
    const opening = {
      Calm:     "Let's slow your body down first. Put both feet on the floor, unclench your jaw, and take one slow breath with me. What's happening right now?",
      Distract: "Good choice. Pick one tiny action: drink water, step outside, text someone safe, or name five blue things in the room. What feels doable?",
      Motivate: "The urge is temporary. The version of you tomorrow morning is counting on this moment. What is one thing you're fighting for right now?",
    };
    navigation.navigate('Support', { mode, urge, openingMessage: opening[mode] });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton navigation={navigation} />
        <Header title="You're not alone." subtitle="Choose what would help most right now." />

        <View style={styles.urgeBox}>
          <Text style={styles.label}>Urge intensity</Text>
          <Text style={styles.urgeNumber}>{urge}/10</Text>
          <View style={styles.row}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setUrge(n)}
                style={[styles.dot, urge >= n && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.modeButton} onPress={() => startMode('Calm')}>
          <Text style={styles.modeTitle}>Calm me down</Text>
          <Text style={styles.modeText}>Breathing, grounding, and slowing the body.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeButton} onPress={() => startMode('Distract')}>
          <Text style={styles.modeTitle}>Distract me</Text>
          <Text style={styles.modeText}>Quick actions to interrupt the urge.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeButton} onPress={() => startMode('Motivate')}>
          <Text style={styles.modeTitle}>Remind me why</Text>
          <Text style={styles.modeText}>Future-self reminders and reasons to stay steady.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.crisisLink} onPress={() => navigation.navigate('EmergencyResources')}>
          <Text style={styles.crisisLinkText}>Crisis lines &amp; emergency resources →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Support Screen (real Claude AI chat) ────────────────────────────────────
function SupportScreen({ navigation, route }) {
  const { mode, urge: urgeStart, openingMessage } = route.params;
  const { authUser } = useContext(AppContext);
  const [messages, setMessages] = useState([{ role: 'assistant', text: openingMessage }]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [urgeEnd, setUrgeEnd] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(600); // 10-minute countdown
  const breathAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // Breathing animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.25, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1,    duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  async function sendMessage() {
    if (!draft.trim() || loading) return;

    const userMsg = { role: 'user', text: draft.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setDraft('');
    setLoading(true);

    try {
      // Build message history in Anthropic format
      const history = updatedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const reply = await callClaudeBackend(history, mode);
      setMessages([...updatedMessages, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          text: "I'm here with you — there was a connection issue. Take a slow breath. You can try again or just sit with this screen for a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function saveSession() {
    if (urgeEnd === null) {
      Alert.alert('Before you go', 'How is your urge intensity now? (tap a number above)');
      return;
    }
    try {
      const sessionRef = await addDoc(collection(db, 'support_sessions'), {
        user_id:    authUser.uid,
        mode:       mode?.toLowerCase(),
        urge_start: urgeStart,
        urge_end:   urgeEnd,
        created_at: serverTimestamp(),
      });

      // Save message log
      const batch = messages.map(m =>
        addDoc(collection(db, 'support_messages'), {
          session_id: sessionRef.id,
          role:       m.role,
          content:    m.text,
          created_at: serverTimestamp(),
        })
      );
      await Promise.all(batch);
      setSessionSaved(true);
      Alert.alert('Session saved', 'Great work getting through this. Progress logged.');
    } catch (e) {
      Alert.alert('Error', 'Could not save session. ' + e.message);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <BackButton navigation={navigation} target="Emergency" />
        <Header
          title={`${mode || 'Support'} Mode`}
          subtitle="Stay with this screen for the next few minutes."
        />

        {/* Countdown timer */}
        <View style={styles.timerBox}>
          {secondsLeft > 0 ? (
            <>
              <Text style={styles.timerLabel}>Stay with it</Text>
              <Text style={styles.timerValue}>{formatTime(secondsLeft)}</Text>
            </>
          ) : (
            <Text style={styles.timerDone}>You made it through. That took strength.</Text>
          )}
        </View>

        {/* Breathing circle */}
        <View style={styles.breathingWrapper}>
          <Animated.View style={[styles.breathingCircle, { transform: [{ scale: breathAnim }] }]}>
            <Text style={styles.breathingText}>Breathe</Text>
          </Animated.View>
        </View>

        {/* Urge-end selector */}
        <View style={styles.urgeBox}>
          <Text style={styles.label}>Urge now (to save session)</Text>
          <View style={styles.row}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setUrgeEnd(n)}
                style={[styles.dot, urgeEnd !== null && urgeEnd >= n && styles.dotActive]}
              />
            ))}
          </View>
          {urgeEnd !== null && <Text style={[styles.label, { marginTop: 8 }]}>{urgeEnd}/10</Text>}
        </View>

        {/* Chat */}
        <View style={styles.chatBox}>
          {messages.map((m, idx) => (
            <View
              key={idx}
              style={[
                styles.message,
                m.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <Text style={styles.messageText}>{m.text}</Text>
            </View>
          ))}
          {loading && (
            <View style={styles.assistantMessage}>
              <ActivityIndicator color="#85A7FF" size="small" />
            </View>
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type what happened…"
            placeholderTextColor="#8C96B3"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={loading}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>

        {!sessionSaved && (
          <TouchableOpacity style={[styles.fullCard, { marginTop: 16 }]} onPress={saveSession}>
            <Text style={[styles.cardTitle, { textAlign: 'center' }]}>Save this session</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Check In Screen ───────────────────────────────────────────────────────────
function CheckInScreen({ navigation }) {
  const { addCheckin } = useContext(AppContext);
  const [mood, setMood] = useState(6);
  const [stress, setStress] = useState(5);
  const [urge, setUrge] = useState(4);
  const [energy, setEnergy] = useState(5);
  const [anxiety, setAnxiety] = useState(4);
  const [focus, setFocus] = useState(5);
  const [loneliness, setLoneliness] = useState(3);
  const [overwhelm, setOverwhelm] = useState(4);
  const [confidence, setConfidence] = useState(6);
  const [impulseOutcome, setImpulseOutcome] = useState('stayed_in_control');
  const [triggers, setTriggers] = useState([]);
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);

  const impulseOptions = [
    { key: 'gave_in', label: 'I gave into an impulse today' },
    { key: 'stayed_in_control', label: 'I stayed in control today' },
    { key: 'difficult', label: 'Today was difficult' },
    { key: 'handled_urges', label: 'I handled urges well' },
  ];
  const triggerOptions = [
    'Stress',
    'Social pressure',
    'Boredom',
    'Loneliness',
    'Anger',
    'Anxiety',
    'Habit',
    'Conflict',
    'Exhaustion',
  ];

  const Scale = ({ label, value, setValue }) => (
    <View style={styles.scaleBox}>
      <Text style={styles.label}>{label}: {value}/10</Text>
      <View style={styles.row}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => setValue(n)}
            style={[styles.dot, value >= n && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );

  function toggleTrigger(trigger) {
    setTriggers(current =>
      current.includes(trigger)
        ? current.filter(item => item !== trigger)
        : [...current, trigger]
    );
  }

  async function handleSave() {
    setSaving(true);
    await addCheckin({
      mood,
      stress,
      urge,
      metrics: {
        energy,
        anxiety,
        focus,
        loneliness,
        overwhelm,
        confidence,
      },
      impulse_outcome: impulseOutcome,
      triggers,
      reflection: reflection.trim(),
    });
    setSaving(false);
    navigation.navigate('Progress');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton navigation={navigation} />
        <Header title="Daily Check-In" subtitle="Thirty seconds. No judgment." />
        <Scale label="Mood" value={mood} setValue={setMood} />
        <Scale label="Stress" value={stress} setValue={setStress} />
        <Scale label="Urge" value={urge} setValue={setUrge} />
        <Scale label="Energy" value={energy} setValue={setEnergy} />
        <Scale label="Anxiety" value={anxiety} setValue={setAnxiety} />
        <Scale label="Focus" value={focus} setValue={setFocus} />
        <Scale label="Loneliness" value={loneliness} setValue={setLoneliness} />
        <Scale label="Emotional overwhelm" value={overwhelm} setValue={setOverwhelm} />
        <Scale label="Confidence" value={confidence} setValue={setConfidence} />

        <View style={styles.scaleBox}>
          <Text style={styles.label}>How did today go?</Text>
          <View style={styles.chipGrid}>
            {impulseOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[styles.choiceChip, impulseOutcome === option.key && styles.choiceChipActive]}
                onPress={() => setImpulseOutcome(option.key)}
              >
                <Text style={[styles.choiceChipText, impulseOutcome === option.key && styles.choiceChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.scaleBox}>
          <Text style={styles.label}>Triggers</Text>
          <View style={styles.chipGrid}>
            {triggerOptions.map(trigger => {
              const selected = triggers.includes(trigger);
              return (
                <TouchableOpacity
                  key={trigger}
                  style={[styles.triggerChip, selected && styles.triggerChipActive]}
                  onPress={() => toggleTrigger(trigger)}
                >
                  <Text style={[styles.triggerChipText, selected && styles.triggerChipTextActive]}>{trigger}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TextInput
          style={styles.reflectionInput}
          multiline
          placeholder="What challenged you most today?"
          placeholderTextColor="#8C96B3"
          value={reflection}
          onChangeText={setReflection}
        />

        <TouchableOpacity
          style={[styles.primaryButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={styles.primaryText}>Save Check-In</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Future Self Screen ────────────────────────────────────────────────────────
function FutureSelfScreen({ navigation }) {
  const { futureMessages, addFutureMessage } = useContext(AppContext);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    await addFutureMessage(draft.trim());
    setDraft('');
    setSaving(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton navigation={navigation} />
        <Header title="Future Self" subtitle="Save reminders from the version of you that feels steady." />
        <TextInput
          style={styles.bigInput}
          multiline
          placeholder="Write a note to yourself for difficult moments…"
          placeholderTextColor="#8C96B3"
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity
          style={[styles.primaryButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={styles.primaryText}>Save Message</Text>
          }
        </TouchableOpacity>
        {futureMessages.map((m, idx) => (
          <View key={m.id || idx} style={styles.fullCard}>
            <Text style={styles.cardText}>{m.message}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Progress Screen ───────────────────────────────────────────────────────────
function ProgressScreen({ navigation }) {
  const { progress, checkins } = useContext(AppContext);

  function outcomeLabel(checkin) {
    if (checkin.impulse_outcome === 'gave_in') return 'Impulse was hard to resist';
    if (checkin.impulse_outcome === 'difficult') return 'Difficult day';
    if (checkin.impulse_outcome === 'handled_urges') return 'Handled urges well';
    if (checkin.impulse_outcome === 'stayed_in_control') return 'Stayed in control';
    return checkin.drank_today ? 'Impulse was hard to resist' : 'Stayed in control';
  }

  function checkinSummary(checkin) {
    const metrics = checkin.metrics || {};
    const parts = [
      `Mood ${checkin.mood || 0}/10`,
      `Stress ${checkin.stress || 0}/10`,
      `Urge ${checkin.urge || 0}/10`,
    ];

    if (metrics.energy) parts.push(`Energy ${metrics.energy}/10`);
    if (metrics.anxiety) parts.push(`Anxiety ${metrics.anxiety}/10`);
    if (metrics.focus) parts.push(`Focus ${metrics.focus}/10`);
    if (metrics.loneliness) parts.push(`Loneliness ${metrics.loneliness}/10`);
    if (metrics.overwhelm) parts.push(`Overwhelm ${metrics.overwhelm}/10`);
    if (metrics.confidence) parts.push(`Confidence ${metrics.confidence}/10`);

    return parts.join(' · ');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton navigation={navigation} />
        <Header title="Progress" subtitle="Patterns, steadiness, and small moments of control." />

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{progress.intentionalDays}</Text>
            <Text style={styles.statLabel}>Intentional days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{progress.avgOverwhelm}/10</Text>
            <Text style={styles.statLabel}>Avg overwhelm</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{progress.avgUrge}/10</Text>
            <Text style={styles.statLabel}>Avg urge</Text>
          </View>
        </View>

        {checkins.map((c, idx) => (
          <View key={c.id || idx} style={styles.fullCard}>
            <Text style={styles.cardTitle}>Check-in #{checkins.length - idx}</Text>
            <Text style={styles.cardText}>{checkinSummary(c)} · {outcomeLabel(c)}</Text>
            {Array.isArray(c.triggers) && c.triggers.length > 0 ? (
              <Text style={[styles.cardText, { marginTop: 8 }]}>Triggers: {c.triggers.join(', ')}</Text>
            ) : null}
            {c.reflection ? (
              <Text style={[styles.cardText, { marginTop: 8 }]}>Reflection: {c.reflection}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Safety Screen ─────────────────────────────────────────────────────────────
function SafetyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton navigation={navigation} />
        <Header title="Safety" subtitle="Elixa is supportive wellness software, not medical care." />
        <View style={styles.fullCard}>
          <Text style={styles.cardTitle}>Important</Text>
          <Text style={styles.cardText}>
            If someone is in immediate danger, contact emergency services or a trusted adult now.
            If a habit, substance, or behavior feels hard to stop safely, medical or professional guidance is strongly recommended.
          </Text>
        </View>
        <View style={styles.fullCard}>
          <Text style={styles.cardTitle}>Crisis resources (US)</Text>
          <Text style={styles.cardText}>
            SAMHSA Helpline: 1-800-662-4357{'\n'}
            Crisis Text Line: Text HOME to 741741{'\n'}
            988 Suicide & Crisis Lifeline: Call or text 988
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Emergency Resources Screen ───────────────────────────────────────────────
const CRISIS_LINES = [
  {
    name:    'Emergency Services',
    detail:  'Police, fire, ambulance — immediate danger',
    number:  '911',
    tel:     'tel:911',
  },
  {
    name:    '988 Suicide & Crisis Lifeline',
    detail:  'Call or text 988 — 24/7, free, confidential',
    number:  '988',
    tel:     'tel:988',
  },
  {
    name:    'SAMHSA National Helpline',
    detail:  'Substance use treatment referrals — 24/7, free',
    number:  '1-800-662-4357',
    tel:     'tel:18006624357',
  },
  {
    name:    'Crisis Text Line',
    detail:  'Text HOME to 741741 — available 24/7',
    number:  'Text HOME → 741741',
    tel:     'sms:741741?body=HOME',
  },
  {
    name:    'Veterans Crisis Line',
    detail:  'Call 988 then press 1, or text 838255',
    number:  '988 (press 1)',
    tel:     'tel:988',
  },
];

function EmergencyResourcesScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton navigation={navigation} target="Emergency" />
        <Header
          title="Crisis Resources"
          subtitle="You don't have to get through this alone. These lines are free, confidential, and available right now."
        />

        {CRISIS_LINES.map((line) => (
          <TouchableOpacity
            key={line.name}
            style={styles.crisisCard}
            onPress={() => Linking.openURL(line.tel).catch(() => {})}
            activeOpacity={0.75}
          >
            <View style={styles.crisisCardTop}>
              <Text style={styles.crisisName}>{line.name}</Text>
              <Text style={styles.crisisNumber}>{line.number}</Text>
            </View>
            <Text style={styles.crisisDetail}>{line.detail}</Text>
          </TouchableOpacity>
        ))}

        <View style={[styles.fullCard, { marginTop: 8 }]}>
          <Text style={styles.cardTitle}>Medical note</Text>
          <Text style={styles.cardText}>
            Sudden withdrawal or severe distress can become dangerous. If you or someone else is shaking,
            confused, having tremors, or feels unsafe, seek emergency care immediately.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08111F' },
  homeContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { padding: 22, paddingBottom: 50 },
  logoLarge: { fontSize: 48, color: 'white', fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  logo: { color: '#85A7FF', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  heroText: { color: 'white', fontSize: 28, fontWeight: '800', textAlign: 'center', lineHeight: 35 },
  heroSub: { color: '#B8C0D4', fontSize: 16, textAlign: 'center', marginTop: 14, marginBottom: 38, lineHeight: 23 },
  header: { marginTop: 16, marginBottom: 24 },
  title: { color: 'white', fontSize: 31, fontWeight: '800', lineHeight: 38 },
  subtitle: { color: '#B8C0D4', fontSize: 16, lineHeight: 23, marginTop: 8 },
  primaryButton: { backgroundColor: '#5478FF', padding: 20, borderRadius: 22, marginTop: 12, marginBottom: 18 },
  primaryText: { color: 'white', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  cardRow: { flexDirection: 'row', gap: 12 },
  smallCard: { flex: 1, backgroundColor: '#111B31', borderRadius: 22, padding: 18, minHeight: 112 },
  fullCard: { backgroundColor: '#111B31', borderRadius: 22, padding: 18, marginTop: 14 },
  cardTitle: { color: 'white', fontWeight: '800', fontSize: 17, marginBottom: 8 },
  cardText: { color: '#B8C0D4', fontSize: 14, lineHeight: 21 },
  footerLink: { marginTop: 28 },
  footerLinkText: { color: '#85A7FF', textAlign: 'center' },
  backButton: { marginTop: 4, marginBottom: 6 },
  backText: { color: '#85A7FF', fontSize: 16, fontWeight: '700' },
  urgeBox: { backgroundColor: '#111B31', padding: 20, borderRadius: 22, marginBottom: 18 },
  label: { color: 'white', fontWeight: '700', marginBottom: 12 },
  urgeNumber: { color: 'white', fontSize: 36, fontWeight: '900', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 7, alignItems: 'center', flexWrap: 'wrap' },
  dot: { width: 22, height: 22, borderRadius: 20, backgroundColor: '#2B3654' },
  dotActive: { backgroundColor: '#6E8CFF' },
  modeButton: { backgroundColor: '#111B31', borderRadius: 22, padding: 20, marginBottom: 14 },
  modeTitle: { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modeText: { color: '#B8C0D4', lineHeight: 21 },
  breathingWrapper: { alignItems: 'center', marginBottom: 24 },
  breathingCircle: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#243C76',
    alignItems: 'center', justifyContent: 'center',
  },
  breathingText: { color: 'white', fontSize: 22, fontWeight: '800' },
  chatBox: { marginBottom: 18 },
  message: { padding: 14, borderRadius: 18, marginBottom: 10, maxWidth: '85%' },
  assistantMessage: { backgroundColor: '#111B31', alignSelf: 'flex-start' },
  userMessage: { backgroundColor: '#5478FF', alignSelf: 'flex-end' },
  messageText: { color: 'white', lineHeight: 21 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#111B31', color: 'white', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14 },
  sendButton: { backgroundColor: '#5478FF', paddingHorizontal: 18, justifyContent: 'center', borderRadius: 16 },
  sendText: { color: 'white', fontWeight: '800' },
  scaleBox: { backgroundColor: '#111B31', padding: 18, borderRadius: 22, marginBottom: 14 },
  toggle: { backgroundColor: '#111B31', padding: 18, borderRadius: 22, marginVertical: 8 },
  toggleText: { color: 'white', fontWeight: '800', textAlign: 'center' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderWidth: 1, borderColor: '#2B3654', backgroundColor: '#0D1629', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  choiceChipActive: { borderColor: '#85A7FF', backgroundColor: '#243C76' },
  choiceChipText: { color: '#B8C0D4', fontWeight: '700', fontSize: 13 },
  choiceChipTextActive: { color: 'white' },
  triggerChip: { borderWidth: 1, borderColor: '#2B3654', backgroundColor: '#0D1629', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  triggerChipActive: { borderColor: '#85A7FF', backgroundColor: '#1A2B55' },
  triggerChipText: { color: '#B8C0D4', fontWeight: '700', fontSize: 13 },
  triggerChipTextActive: { color: 'white' },
  bigInput: { backgroundColor: '#111B31', color: 'white', minHeight: 130, borderRadius: 22, padding: 18, textAlignVertical: 'top', fontSize: 16, lineHeight: 23 },
  reflectionInput: { backgroundColor: '#111B31', color: 'white', minHeight: 105, borderRadius: 22, padding: 18, textAlignVertical: 'top', fontSize: 16, lineHeight: 23, marginBottom: 8 },
  statsGrid: { gap: 12 },
  statCard: { backgroundColor: '#111B31', borderRadius: 22, padding: 20 },
  statNumber: { color: 'white', fontSize: 32, fontWeight: '900' },
  statLabel: { color: '#B8C0D4', marginTop: 4 },
  authInput: { backgroundColor: '#111B31', color: 'white', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12, fontSize: 16 },
  errorText: { color: '#FF7070', marginBottom: 10, textAlign: 'center' },
  // Countdown timer
  timerBox: { backgroundColor: '#111B31', borderRadius: 22, padding: 20, marginBottom: 18, alignItems: 'center' },
  timerLabel: { color: '#B8C0D4', fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  timerValue: { color: 'white', fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerDone: { color: '#85A7FF', fontSize: 17, fontWeight: '700', textAlign: 'center', lineHeight: 25 },
  // Emergency resources
  crisisLink: { marginTop: 22, alignItems: 'center', padding: 14 },
  crisisLinkText: { color: '#FF7070', fontSize: 15, fontWeight: '700' },
  crisisCard: { backgroundColor: '#1A0A0A', borderWidth: 1, borderColor: '#3D1414', borderRadius: 22, padding: 20, marginBottom: 14 },
  crisisCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  crisisName: { color: 'white', fontWeight: '800', fontSize: 16, flex: 1, marginRight: 8 },
  crisisNumber: { color: '#FF7070', fontWeight: '900', fontSize: 15 },
  crisisDetail: { color: '#B8C0D4', fontSize: 13, lineHeight: 19 },
});
