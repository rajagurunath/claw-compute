"""workload on offerings + settlement_txs, deposit-kind support

Revision ID: a7c1e9f4b230
Revises: c3d9a4e8b2f6
Create Date: 2026-07-12 10:00:00.000000

* offerings.workload        — which agent runtime a booking spins up
                              (openclaw|sandbox|inference|hermes), default sandbox
* settlement_txs.workload   — snapshot so the ledger can show it per settlement
  (the new `deposit` kind reuses the existing `kind` column — no schema change)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c1e9f4b230'
down_revision: Union[str, Sequence[str], None] = 'c3d9a4e8b2f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'offerings',
        sa.Column(
            'workload',
            sa.String(length=16),
            nullable=False,
            server_default='sandbox',
        ),
    )
    # Drop the server_default now that existing rows are backfilled; the ORM
    # supplies the value on insert going forward.
    op.alter_column('offerings', 'workload', server_default=None)
    op.add_column(
        'settlement_txs',
        sa.Column('workload', sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('settlement_txs', 'workload')
    op.drop_column('offerings', 'workload')
