import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { COLORS } from './theme';

/** Last-resort boundary: shows a retry button (icon + one word) instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.sky, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.ok')} onPress={() => this.setState({ failed: false })} style={{ minWidth: 120, minHeight: 56, borderRadius: 28, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{t('common.ok')}</Text>
        </Pressable>
      </View>
    );
  }
}
