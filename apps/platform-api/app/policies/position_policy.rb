class PositionPolicy < ApplicationPolicy
  def show? = owns_portfolio?
  def create? = owns_portfolio?
  def update? = owns_portfolio?
  def destroy? = owns_portfolio?

  private

  def owns_portfolio? = record.portfolio.user_id == user.id
end
