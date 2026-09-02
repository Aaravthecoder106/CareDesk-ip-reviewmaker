CREATE POLICY "family reports read"
ON public.reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.status = 'accepted'
      AND (
        (fm.owner_id = reports.user_id AND fm.member_id = auth.uid())
        OR (fm.member_id = reports.user_id AND fm.owner_id = auth.uid())
      )
  )
);