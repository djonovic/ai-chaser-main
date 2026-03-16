import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AppSettings {
  sender_name: string;
  company_name: string;
}

const defaultSettings: AppSettings = {
  sender_name: '',
  company_name: '',
};

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('sender_name, company_name')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine for new users
        console.error('Error fetching settings:', error);
      }

      if (data) {
        setSettings({
          sender_name: data.sender_name || '',
          company_name: data.company_name || '',
        });
      }
    } catch (err) {
      console.error('Error in fetchSettings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    if (!user) return;

    try {
      // Upsert: insert if not exists, update if exists
      const { error } = await supabase
        .from('settings')
        .upsert(
          { user_id: user.id, ...updates },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...updates }));
      toast.success('Settings saved');
    } catch (err) {
      console.error('Error updating settings:', err);
      toast.error('Failed to save settings');
    }
  }, [user]);

  return { settings, updateSettings, loading };
}
