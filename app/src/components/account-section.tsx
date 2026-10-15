import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signIn, signOut } from '@/services/auth';
import { useAuthStore } from '@/stores/auth-store';

/** The backend says 401 for both wrong fields: so does the screen. */
function loginError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return 'Identifiant ou mot de passe incorrect';
  if (error instanceof ApiError && error.status === 429) return 'Trop de tentatives, réessayez dans une minute';
  return 'Serveur injoignable';
}

/**
 * Reading needs no account; the LED and the thresholds do. Hence a section in
 * Réglages rather than a gate in front of the whole app.
 */
export function AccountSection() {
  const session = useAuthStore((state) => state.session);
  const loaded = useAuthStore((state) => state.loaded);
  const theme = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !username || !password) return;

    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      // Gone from memory as soon as it is used: only the token is kept.
      setPassword('');
    } catch (failure) {
      setError(loginError(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  if (session) {
    return (
      <View style={styles.section}>
        <View style={styles.row}>
          <ThemedText type="small" style={styles.grow}>
            Connecté en tant que <ThemedText type="smallBold">{session.username}</ThemedText>
          </ThemedText>
          <Pressable onPress={signOut} accessibilityRole="button">
            <ThemedText type="smallBold" themeColor="textSecondary">
              Se déconnecter
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary">
        Connectez-vous pour piloter la LED et modifier les seuils.
      </ThemedText>

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Identifiant"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        style={inputStyle}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        style={inputStyle}
      />

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable onPress={submit} disabled={busy} accessibilityRole="button">
        <ThemedView type="backgroundButton" style={styles.button}>
          <ThemedText type="smallBold">{busy ? 'CONNEXION…' : 'SE CONNECTER'}</ThemedText>
        </ThemedView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  error: {
    color: '#ff3b30',
    fontWeight: 'bold',
  },
  button: {
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
