-- parents.phone нь User.phone-той 1:1 тэнцүү утгатай байх ёстой (нэг
-- хэрэглэгч = нэг эцэг эх). Давхардсан утас DB-ийн түвшинд хориглоно.
ALTER TABLE parents
  ADD CONSTRAINT parents_phone_key UNIQUE (phone);
