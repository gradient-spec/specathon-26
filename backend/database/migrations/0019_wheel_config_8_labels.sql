-- Add the 6 remaining labels to the wheel_config table
ALTER TABLE public.wheel_config 
    ADD COLUMN better_luck_a_name text NOT NULL DEFAULT 'Better luck next time',
    ADD COLUMN better_luck_b_name text NOT NULL DEFAULT 'Try again next year',
    ADD COLUMN dummy_1_name text NOT NULL DEFAULT 'T-Shirt',
    ADD COLUMN dummy_2_name text NOT NULL DEFAULT 'Sticker Pack',
    ADD COLUMN dummy_3_name text NOT NULL DEFAULT 'Water Bottle',
    ADD COLUMN dummy_4_name text NOT NULL DEFAULT 'Coffee Mug';
