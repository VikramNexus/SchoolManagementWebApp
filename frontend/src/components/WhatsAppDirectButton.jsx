import React, { useState } from 'react';
import { MessageSquare, Check, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from './Toast';
import './WhatsAppDirectButton.css';

/**
 * WhatsAppDirectButton
 * Direct WhatsApp dispatch button with auto-fallback for Desktop & Mobile devices
 */
export default function WhatsAppDirectButton({
  onSend,
  phone = '',
  defaultLabel = 'Send WhatsApp',
  successLabel = '✓ WhatsApp Sent',
  size = 'md',
  compact = false,
  className = '',
  disabled = false,
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const handleClick = async (e) => {
    e.stopPropagation();
    if (status === 'sending' || disabled) return;

    setStatus('sending');
    setErrorMessage('');

    try {
      if (onSend) {
        const res = await onSend();
        if (res?.data?.direct_link) {
          const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = res.data.direct_link;
          } else {
            window.open(res.data.direct_link, '_blank');
          }
        }
        toast.success(res?.data?.message || 'WhatsApp dispatched successfully!');
      }
      setStatus('sent');
    } catch (err) {
      console.error('[WhatsAppDirectButton]', err);
      const cleanPhone = (phone || '').replace(/\D/g, '');
      if (cleanPhone) {
        // Safe direct fallback
        const waNum = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        window.open(`https://wa.me/${waNum}`, '_blank');
        toast.info('Opened WhatsApp chat directly with parent');
        setStatus('sent');
      } else {
        setStatus('error');
        const msg = err?.response?.data?.message || err?.message || 'Failed to send WhatsApp message';
        setErrorMessage(msg);
        toast.error(msg);
        setTimeout(() => setStatus('idle'), 4000);
      }
    }
  };

  const isSent = status === 'sent';
  const isSending = status === 'sending';
  const isError = status === 'error';

  return (
    <button
      type="button"
      className={`btn-whatsapp-direct ${size} ${status} ${compact ? 'compact' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled || isSending}
      title={
        isSent
          ? `Dispatched via WhatsApp to parent (${phone || 'Registered Phone'})`
          : isError
          ? `Error: ${errorMessage}`
          : `Send directly via WhatsApp in background${phone ? ` (${phone})` : ''}`
      }
    >
      {isSending && <Loader2 size={size === 'sm' ? 14 : 16} className="wa-spinner" />}
      {isSent && <Check size={size === 'sm' ? 14 : 16} className="wa-check-icon" />}
      {isError && <AlertCircle size={size === 'sm' ? 14 : 16} className="wa-error-icon" />}
      {!isSending && !isSent && !isError && (
        <MessageSquare size={size === 'sm' ? 14 : 16} className="wa-icon" />
      )}

      {!compact && (
        <span className="wa-btn-text">
          {isSending ? 'Sending...' : isSent ? successLabel : isError ? 'Retry WhatsApp' : defaultLabel}
        </span>
      )}
    </button>
  );
}
