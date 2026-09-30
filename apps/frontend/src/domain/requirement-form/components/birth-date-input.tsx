'use client';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
} from '@repo/ui/base/input-otp';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  formValueFromOtpDigits,
  otpDigitsFromStoredDate,
  partsFromDateFormat,
} from './birth-date-segments';

type BirthDateInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

export function BirthDateInput({
  id,
  value,
  onChange,
  disabled = false,
  'aria-invalid': ariaInvalid,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: BirthDateInputProps) {
  const t = useTranslations('RequirementForm.volunteerForm');
  const format = t('birthDateFormat');
  const { placeholders, separator } = partsFromDateFormat(format);
  const formatHintId = `${id}-date-format`;
  const describedBy = [ariaDescribedBy, formatHintId].filter(Boolean).join(' ');
  const [digits, setDigits] = useState(() => otpDigitsFromStoredDate(value));
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    setDigits(otpDigitsFromStoredDate(value));
    lastEmittedRef.current = value;
  }, [value]);

  const slot = (index: number) => (
    <InputOTPSlot
      index={index}
      aria-invalid={ariaInvalid}
      placeholder={placeholders[index]}
    />
  );

  return (
    <>
      {/* The eight segments are a fixed width and cannot shrink, so in a narrow
          column — the form editor's preview panel — they would run off the
          edge. Wrapping lets day, month and year drop to the next line
          together, which keeps each group readable as a unit. */}
      <InputOTP
        id={id}
        containerClassName="flex-wrap"
        maxLength={8}
        pattern={REGEXP_ONLY_DIGITS}
        value={digits}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={describedBy || undefined}
        onChange={(next) => {
          setDigits(next);
          const nextValue = formValueFromOtpDigits(next);
          lastEmittedRef.current = nextValue;
          onChange(nextValue);
        }}
      >
        <InputOTPGroup>
          {slot(0)}
          {slot(1)}
        </InputOTPGroup>
        <InputOTPSeparator>{separator}</InputOTPSeparator>
        <InputOTPGroup>
          {slot(2)}
          {slot(3)}
        </InputOTPGroup>
        <InputOTPSeparator>{separator}</InputOTPSeparator>
        <InputOTPGroup>
          {slot(4)}
          {slot(5)}
          {slot(6)}
          {slot(7)}
        </InputOTPGroup>
      </InputOTP>
      <span id={formatHintId} className="sr-only">
        {format}
      </span>
    </>
  );
}
