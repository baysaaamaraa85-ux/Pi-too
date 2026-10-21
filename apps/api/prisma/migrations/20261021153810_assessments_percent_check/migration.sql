-- ФШ-38: 0-100-аас гадуурх хувь хүлээн авахгүй.
ALTER TABLE assessments
  ADD CONSTRAINT assessments_total_percent_range
    CHECK (total_percent >= 0 AND total_percent <= 100);
