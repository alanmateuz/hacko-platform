DROP TABLE `login_tokens`;--> statement-breakpoint
-- Contas anteriores vieram de OAuth ou link por e-mail: e-mail já confirmado.
UPDATE `users` SET `email_verified` = 1;
